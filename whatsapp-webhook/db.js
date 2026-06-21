'use strict';

const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      charset: 'utf8mb4',
      timezone: '+05:30',
      connectionLimit: 5,
      connectTimeout: 10000,
      waitForConnections: true,
    });
  }
  return pool;
}

/**
 * Look up a user by phone number.
 * Returns { id, firstName, lastName, userType } or null.
 * Phone is stored with or without country code — try both.
 */
async function findUserByPhone(rawPhone) {
  const db = getPool();

  // Normalise: strip leading '+' and leading '0', build variants to match
  const digits = rawPhone.replace(/\D/g, '');
  // e.g. "0771234567" → "771234567", "+94771234567" → "94771234567"
  const variants = new Set([
    rawPhone,
    digits,
    digits.replace(/^0/, ''),           // strip leading 0
    `+${digits}`,                        // with +
    `0${digits.replace(/^0/, '')}`,      // with leading 0
  ]);

  const placeholders = [...variants].map(() => '?').join(', ');
  const [rows] = await db.execute(
    `SELECT id, first_name AS firstName, last_name AS lastName, user_type AS userType
     FROM users
     WHERE phone_number IN (${placeholders})
       AND is_active = 1
     LIMIT 1`,
    [...variants],
  );

  return rows[0] || null;
}

/**
 * Get the parent record for a user id.
 * Returns the parent row or null.
 */
async function findParentByUserId(userId) {
  const db = getPool();
  const [rows] = await db.execute(
    'SELECT id, user_id AS userId FROM parents WHERE user_id = ? AND is_active = 1 LIMIT 1',
    [userId],
  );
  return rows[0] || null;
}

/**
 * Get all active children (students) for a parent user id.
 * A parent may appear as father, mother, or guardian.
 * Returns [{ userId, firstName, lastName }]
 */
async function findChildrenOfParent(parentUserId) {
  const db = getPool();
  const [rows] = await db.execute(
    `SELECT s.user_id AS userId,
            u.first_name AS firstName,
            u.last_name  AS lastName
     FROM students s
     JOIN users u ON u.id = s.user_id AND u.is_active = 1
     WHERE s.is_active = 1
       AND (s.father_id = ? OR s.mother_id = ? OR s.guardian_id = ?)
     ORDER BY s.user_id ASC`,
    [parentUserId, parentUserId, parentUserId],
  );
  return rows;
}

/**
 * Get the institute enrolments of a student.
 * Returns [{ instituteId, instituteName }] — one row per institute.
 */
async function findStudentInstitutes(studentUserId) {
  const db = getPool();
  const [rows] = await db.execute(
    `SELECT iu.institute_id AS instituteId,
            i.name          AS instituteName
     FROM institute_user iu
     JOIN institutes i ON i.id = iu.institute_id AND i.is_active = 1
     WHERE iu.user_id = ?
       AND iu.status = 'ACTIVE'
     LIMIT 10`,
    [studentUserId],
  );
  return rows;
}

/**
 * Get attendance records for a student in one institute over the last 7 days.
 * Returns [{ date, status }] sorted by date desc.
 * status: 0=Absent 1=Present 2=Late 3=Left 4=LeftEarly 5=LeftLately
 */
async function getAttendanceLast7Days(studentUserId, instituteId) {
  const db = getPool();

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6); // today + 6 prior days = 7 days

  const fmt = (d) => d.toISOString().split('T')[0];

  const [rows] = await db.execute(
    `SELECT ar.date,
            ar.status,
            ar.timestamp AS checkInTime
     FROM attendance_records ar
     WHERE ar.student_id = ?
       AND ar.institute_id = ?
       AND ar.date BETWEEN ? AND ?
     ORDER BY ar.date DESC`,
    [String(studentUserId), String(instituteId), fmt(start), fmt(end)],
  );
  return rows;
}

// ─── OTP confirmation (reverse-OTP via WhatsApp link) ──────────────────────────

/**
 * Normalize a Sri Lankan phone to +94XXXXXXXXX. Mirrors the backend's
 * normalizeSriLankanPhone so the sender-phone binding check matches what the
 * backend stored. Returns null if it can't be normalized.
 */
function normalizePhone(raw) {
  if (!raw) return null;
  let c = String(raw).replace(/[^\d+]/g, '');
  const hadPlus = c.startsWith('+');
  if (hadPlus) c = c.slice(1);
  c = c.replace(/^0+/, '');
  if (c.startsWith('94')) return `+${c}`;
  if (c.startsWith('7') && c.length === 9) return `+94${c}`;
  if (c.length === 10 && c.startsWith('0')) return `+94${c.slice(1)}`;
  if (c.length === 9) return `+94${c}`;
  if (c.length >= 10 && c.length <= 15 && /^\d+$/.test(c)) return `+${c}`;
  return null;
}

/**
 * Confirm a WhatsApp-delivered OTP in user_otps.
 *
 * SECURITY — the OTP is accepted only if:
 *   1. a pending (is_verified=0, not expired, delivery=WHATSAPP) row matches the code, AND
 *   2. the WhatsApp SENDER phone equals the phone the OTP was issued for.
 *
 * A leaked code sent from a different phone is rejected.
 *
 * @returns 'verified' | 'mismatch' | 'not_found'
 */
async function confirmUserOtp(code, senderPhoneRaw) {
  const dbi = getPool();
  const sender = normalizePhone(senderPhoneRaw);
  if (!sender) return 'not_found';

  // Find the newest pending WhatsApp OTP for this code.
  const [rows] = await dbi.execute(
    `SELECT id, phone_number AS phoneNumber, attempts
     FROM user_otps
     WHERE otp_code = ?
       AND delivery_method = 'WHATSAPP'
       AND is_verified = 0
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [code],
  );

  if (rows.length === 0) return 'not_found';

  const row = rows[0];

  // Brute-force cap — after 5 failed binding attempts, expire the OTP.
  if (Number(row.attempts) >= 5) {
    await dbi.execute('UPDATE user_otps SET expires_at = NOW() WHERE id = ?', [row.id]);
    return 'not_found';
  }

  const boundPhone = normalizePhone(row.phoneNumber);

  // Binding check — sender must equal the phone the OTP was issued for.
  if (!boundPhone || boundPhone !== sender) {
    // Count the failed attempt against this OTP row (brute-force friction).
    await dbi.execute('UPDATE user_otps SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    return 'mismatch';
  }

  await dbi.execute(
    `UPDATE user_otps
     SET is_verified = 1, verified_at = NOW(), wa_sender_phone = ?
     WHERE id = ?`,
    [sender, row.id],
  );
  return 'verified';
}

/**
 * Confirm a WhatsApp-delivered OTP in password_reset_tokens.
 * Same binding rule as confirmUserOtp.
 * @returns 'verified' | 'mismatch' | 'not_found'
 */
async function confirmPasswordResetOtp(code, senderPhoneRaw) {
  const dbi = getPool();
  const sender = normalizePhone(senderPhoneRaw);
  if (!sender) return 'not_found';

  const [rows] = await dbi.execute(
    `SELECT id, phone_number AS phoneNumber, attemptCount
     FROM password_reset_tokens
     WHERE otp = ?
       AND delivery_method = 'WHATSAPP'
       AND isUsed = 0
       AND isOtpVerified = 0
       AND expiresAt > NOW()
     ORDER BY createdAt DESC
     LIMIT 1`,
    [code],
  );

  if (rows.length === 0) return 'not_found';

  const row = rows[0];

  // Brute-force cap — after 5 failed binding attempts, invalidate the token.
  if (Number(row.attemptCount) >= 5) {
    await dbi.execute('UPDATE password_reset_tokens SET isUsed = 1, updatedAt = NOW() WHERE id = ?', [row.id]);
    return 'not_found';
  }

  const boundPhone = normalizePhone(row.phoneNumber);

  if (!boundPhone || boundPhone !== sender) {
    await dbi.execute('UPDATE password_reset_tokens SET attemptCount = attemptCount + 1 WHERE id = ?', [row.id]);
    return 'mismatch';
  }

  await dbi.execute(
    `UPDATE password_reset_tokens
     SET isOtpVerified = 1, wa_sender_phone = ?, updatedAt = NOW()
     WHERE id = ?`,
    [sender, row.id],
  );
  return 'verified';
}

module.exports = {
  findUserByPhone,
  findParentByUserId,
  findChildrenOfParent,
  findStudentInstitutes,
  getAttendanceLast7Days,
  confirmUserOtp,
  confirmPasswordResetOtp,
  normalizePhone,
};
