/**
 * Fixes migrated attendance timestamps using bulk UPDATE with temp table.
 * Sets timestamp = checkInAt and created_at = createdAt from source.
 */
require('./lms-api-suraksha-lk/node_modules/dotenv').config({ path: './lms-api-suraksha-lk/.env' });
const mysql = require('./lms-api-suraksha-lk/node_modules/mysql2/promise');

function toDate(d) { return new Date(d).toISOString().slice(0, 10); }

async function run() {
  const src = await mysql.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: 'thilinadhananjaya_lms',
  });
  const dst = await mysql.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: 'suraksha-lms-db',
  });

  const WINS_SRC = 'ba1485bc-2756-4505-b43d-2af56d4b6a72';
  const SIHASMA_SRC = 'c0d6b894-ff73-4517-9154-fa7e2449a6ed';
  const INST_ID = '6e09518a-89ac-47e1-8961-326b5fd5fc9c';

  // Build userMap srcId -> dstId
  const [srcStudents] = await src.query(`
    SELECT DISTINCT u.id as srcId, u.email, p.barcodeId, p.phone
    FROM User u JOIN Profile p ON p.userId = u.id
    JOIN Enrollment e ON e.userId = u.id JOIN Class c ON c.id = e.classId
    WHERE c.orgId IN (?, ?)
  `, [WINS_SRC, SIHASMA_SRC]);

  const [dstIUsers] = await dst.query(`
    SELECT u.id as dstId, u.email, u.phone_number, iu.extra_data
    FROM users u JOIN institute_user iu ON iu.user_id = u.id WHERE iu.institute_id = ?
  `, [INST_ID]);

  const emailToDst = {}, phoneToDst = {}, barcodeToDst = {};
  for (const du of dstIUsers) {
    if (du.email) emailToDst[du.email.toLowerCase()] = du.dstId;
    if (du.phone_number) phoneToDst[du.phone_number] = du.dstId;
    try { const ex = JSON.parse(du.extra_data||'{}'); if (ex.barcodeId) barcodeToDst[ex.barcodeId] = du.dstId; } catch {}
  }
  const userMap = {};
  for (const s of srcStudents) {
    let id = null;
    if (s.email?.includes('@')) id = emailToDst[s.email.toLowerCase()];
    if (!id && s.phone) id = phoneToDst[s.phone];
    if (!id && s.barcodeId) id = barcodeToDst[s.barcodeId];
    if (id) userMap[s.srcId] = id;
  }
  console.log(`User map: ${Object.keys(userMap).length} / ${srcStudents.length}`);

  // Load all source attendance
  const [srcAtt] = await src.query(`
    SELECT a.userId, a.sessionCode, a.checkInAt, a.createdAt
    FROM ClassAttendance a JOIN Class c ON c.id = a.classId
    WHERE c.orgId IN (?, ?)
  `, [WINS_SRC, SIHASMA_SRC]);
  console.log('Source records:', srcAtt.length);

  // Build lookup: dstUserId|sessionCode -> { ts, createdAt }
  // When same user+sessionCode appears multiple times (dup sessions), keep first
  const lookup = {};
  for (const a of srcAtt) {
    const dstId = userMap[a.userId];
    if (!dstId) continue;
    const key = `${dstId}||${a.sessionCode}`;
    if (!lookup[key]) {
      lookup[key] = {
        ts: a.checkInAt ? new Date(a.checkInAt).getTime() : null,
        ca: a.createdAt ? new Date(a.createdAt) : null,
      };
    }
  }
  console.log('Lookup entries:', Object.keys(lookup).length);

  // Load all dst migrated records with session name
  const [dstRecs] = await dst.query(`
    SELECT ar.id, ar.student_id, s.name as sessionCode
    FROM attendance_records ar
    JOIN institute_class_attendance_sessions s ON s.id = ar.class_session_id
    WHERE ar.marking_method LIKE 'MIGRATION%' AND ar.institute_id = ?
  `, [INST_ID]);
  console.log('Dst records to fix:', dstRecs.length);

  // Build batch update values: [ts, ca, id]
  const updates = [];
  let skipped = 0;
  for (const rec of dstRecs) {
    const key = `${rec.student_id}||${rec.sessionCode}`;
    const s = lookup[key];
    if (!s || (s.ts === null && s.ca === null)) { skipped++; continue; }
    updates.push([s.ts, s.ca, rec.id]);
  }
  console.log(`Updates to apply: ${updates.length} | skipped: ${skipped}`);

  // Execute in batches of 1000 using INSERT INTO temp table + single JOIN UPDATE
  await dst.query('SET FOREIGN_KEY_CHECKS = 0');
  await dst.query(`CREATE TEMPORARY TABLE IF NOT EXISTS att_ts_fix (
    rec_id INT PRIMARY KEY,
    new_ts BIGINT,
    new_ca TIMESTAMP NULL
  )`);

  const BATCH = 1000;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    const placeholders = chunk.map(() => '(?,?,?)').join(',');
    const vals = chunk.flatMap(r => [r[2], r[0], r[1]]);
    await dst.query(`INSERT INTO att_ts_fix (rec_id, new_ts, new_ca) VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE new_ts=VALUES(new_ts), new_ca=VALUES(new_ca)`, vals);
    if ((i + BATCH) % 5000 === 0) console.log(`  ...${i + BATCH} rows staged`);
  }
  console.log('Temp table populated, running JOIN UPDATE...');

  const [result] = await dst.query(`
    UPDATE attendance_records ar
    JOIN att_ts_fix f ON f.rec_id = ar.id
    SET ar.timestamp = COALESCE(f.new_ts, ar.timestamp),
        ar.created_at = COALESCE(f.new_ca, ar.created_at)
  `);
  console.log('Rows updated:', result.affectedRows);

  await dst.query('DROP TEMPORARY TABLE att_ts_fix');
  await dst.query('SET FOREIGN_KEY_CHECKS = 1');

  // Verify
  const [sample] = await dst.query(`
    SELECT ar.student_id, ar.timestamp, ar.created_at, s.name as sessionCode
    FROM attendance_records ar
    JOIN institute_class_attendance_sessions s ON s.id = ar.class_session_id
    WHERE ar.marking_method LIKE 'MIGRATION%' AND ar.institute_id = ?
    LIMIT 3
  `, [INST_ID]);
  console.log('\nSample after fix:');
  sample.forEach(r => console.log(' ', r.student_id, '|', r.sessionCode,
    '| checkIn:', new Date(Number(r.timestamp)).toISOString(),
    '| created:', r.created_at));

  await src.end();
  await dst.end();
}

run().catch(console.error);
