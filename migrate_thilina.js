/**
 * Full migration: thilinadhananjaya_lms -> suraksha-lms-db
 * Migrates WINS + Sihasma institutes, students, classes, enrollments,
 * session groups, sessions (>5 marks only), and attendance records.
 */
require('./lms-api-suraksha-lk/node_modules/dotenv').config({ path: './lms-api-suraksha-lk/.env' });
const mysql = require('./lms-api-suraksha-lk/node_modules/mysql2/promise');
const crypto = require('crypto');

function uuid() { return crypto.randomUUID(); }
const ts = new Date();

function toDate(d) {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

function mapStatus(s) { return s === 'PRESENT' ? 1 : 0; }

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
  const ADMIN_ID = 1;

  await dst.query('SET FOREIGN_KEY_CHECKS = 0');

  // ════════════════════════════════════════════════════════
  // STEP 1 — Create institutes
  // ════════════════════════════════════════════════════════
  console.log('\n[1] Creating institutes...');
  const WINS_ID = uuid();
  const SIHASMA_ID = uuid();

  // Extra data schema stored on the institute itself
  const extraSchema = JSON.stringify([
    { key: 'school',                 label: 'School',                   type: 'text'  },
    { key: 'guardianName',           label: 'Guardian Name',            type: 'text'  },
    { key: 'guardianPhone',          label: 'Guardian Phone',           type: 'phone' },
    { key: 'guardianRelationship',   label: 'Guardian Relationship',    type: 'text'  },
    { key: 'occupation',             label: 'Occupation',               type: 'text'  },
    { key: 'telephone',              label: 'Telephone',                type: 'phone' },
    { key: 'whatsappPhone',          label: 'WhatsApp Phone',           type: 'phone' },
    { key: 'emergencyContactName',   label: 'Emergency Contact Name',   type: 'text'  },
    { key: 'emergencyContactPhone',  label: 'Emergency Contact Phone',  type: 'phone' },
    { key: 'barcodeId',              label: 'Barcode / Member ID',      type: 'text'  },
    { key: 'instituteName',          label: 'Institute Name',           type: 'text'  },
  ]);

  await dst.query(`INSERT INTO institutes
    (id, name, short_name, code, email, phone, is_active, type, tier,
     custom_domain_verified, custom_login_enabled, powered_by_visible,
     is_visible_in_app, is_visible_in_web_selector, is_default,
     login_background_type, allow_user_photo_upload, is_strict_session_limit,
     user_extra_data_schema, created_at, updated_at)
    VALUES
    (?, 'WINS', 'WINS', 'WINS', 'wins@wins.lk', NULL, 1, 'tuition_institute', 'FREE',
     0, 0, 1, 1, 1, 0, 'COLOR', 1, 0, ?, ?, ?),
    (?, 'Sihasma', 'Sihasma', 'SIHASMA', 'sihasma@sihasma.lk', NULL, 1, 'tuition_institute', 'FREE',
     0, 0, 1, 1, 1, 0, 'COLOR', 1, 0, ?, ?, ?)`,
    [WINS_ID, extraSchema, ts, ts, SIHASMA_ID, extraSchema, ts, ts]);
  console.log('  WINS id:', WINS_ID);
  console.log('  Sihasma id:', SIHASMA_ID);

  const instMap = { [WINS_SRC]: WINS_ID, [SIHASMA_SRC]: SIHASMA_ID };

  // ════════════════════════════════════════════════════════
  // STEP 2 — Create institute_user_types (STUDENT type) for each
  // ════════════════════════════════════════════════════════
  console.log('\n[2] Creating user types...');
  const [[maxTypeRow]] = await dst.query('SELECT MAX(id) as m FROM institute_user_types');
  const baseTypeId = (maxTypeRow.m || 0) + 1;
  const winsStudentTypeId = baseTypeId;
  const sihasmaStudentTypeId = baseTypeId + 1;

  await dst.query(`INSERT INTO institute_user_types
    (id, name, name_plural, slug, description, color, is_system_type, is_public, is_active, sort_order, created_at, updated_at, institute_id)
    VALUES
    (?, 'Student', 'Students', 'student', NULL, '#3B82F6', 1, 1, 1, 1, ?, ?, ?),
    (?, 'Student', 'Students', 'student', NULL, '#3B82F6', 1, 1, 1, 1, ?, ?, ?)`,
    [winsStudentTypeId, ts, ts, WINS_ID, sihasmaStudentTypeId, ts, ts, SIHASMA_ID]);

  // ════════════════════════════════════════════════════════
  // STEP 3 — Register admin as institute admin for both
  // ════════════════════════════════════════════════════════
  console.log('\n[3] Registering admin user to institutes...');
  for (const instId of [WINS_ID, SIHASMA_ID]) {
    await dst.query(`INSERT IGNORE INTO institute_user
      (user_id, institute_id, status, institute_user_type, image_verification_status, created_at, updated_at)
      VALUES (?, ?, 'ACTIVE', 'INSTITUTE_ADMIN', 'VERIFIED', ?, ?)`,
      [ADMIN_ID, instId, ts, ts]);
  }

  // ════════════════════════════════════════════════════════
  // STEP 4 — Load source classes (WINS + Sihasma only)
  // ════════════════════════════════════════════════════════
  console.log('\n[4] Loading source classes...');
  const [srcClasses] = await src.query(`
    SELECT id, name, orgId, description FROM Class WHERE orgId IN (?, ?)
  `, [WINS_SRC, SIHASMA_SRC]);
  console.log('  Source classes:', srcClasses.map(c => c.name).join(', '));

  // ════════════════════════════════════════════════════════
  // STEP 5 — Load and insert students
  // ════════════════════════════════════════════════════════
  console.log('\n[5] Loading students from source...');
  const [students] = await src.query(`
    SELECT DISTINCT u.id as srcId, u.email,
           p.fullName, p.phone, p.whatsappPhone, p.school, p.dateOfBirth,
           p.address, p.guardianName, p.guardianPhone, p.relationship,
           p.status, p.gender, p.barcodeId, p.avatarUrl, p.enrolledDate,
           p.telephone, p.guardianTelephone, p.emergencyContactPhone,
           p.emergencyContactName, p.occupation
    FROM User u
    JOIN Profile p ON p.userId = u.id
    JOIN Enrollment e ON e.userId = u.id
    JOIN Class c ON c.id = e.classId
    WHERE c.orgId IN (?, ?)
  `, [WINS_SRC, SIHASMA_SRC]);
  console.log('  Students found:', students.length);

  // srcId -> primary institute
  const [sInstRows] = await src.query(`
    SELECT DISTINCT u.id as srcId, c.orgId
    FROM User u JOIN Enrollment e ON e.userId=u.id JOIN Class c ON c.id=e.classId
    WHERE c.orgId IN (?, ?)
  `, [WINS_SRC, SIHASMA_SRC]);
  const studentInst = {};
  for (const r of sInstRows) {
    if (!studentInst[r.srcId] || r.orgId === WINS_SRC) studentInst[r.srcId] = r.orgId;
  }

  const [[maxUserRow]] = await dst.query('SELECT MAX(id) as m FROM users');
  let nextId = (maxUserRow.m || 2) + 1;
  const userMap = {}; // srcId (string) -> dst bigint
  let uCount = 0;

  console.log('  Inserting users...');
  for (const s of students) {
    const newId = nextId++;
    userMap[s.srcId] = newId;

    const parts = (s.fullName || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    const dob = toDate(s.dateOfBirth);
    const gender = s.gender && ['MALE','FEMALE','OTHER'].includes(s.gender.toUpperCase())
      ? s.gender.toUpperCase() : null;
    const email = (s.email && s.email.includes('@') && !/^\d/.test(s.email))
      ? s.email : null;

    await dst.query(`INSERT INTO users
      (id, first_name, last_name, email, phone_number, gender, date_of_birth,
       user_type, is_active, district, province, country, language, subscription_plan,
       created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'USER', 1, 'COLOMBO', 'WESTERN', 'Sri Lanka', 'S', 'FREE', ?, ?)`,
      [newId, firstName, lastName, email,
       s.phone || s.telephone || null, gender, dob, ts, ts]);

    uCount++;
    if (uCount % 100 === 0) console.log(`  ...${uCount} users`);
  }
  console.log('  Users created:', uCount);

  // ════════════════════════════════════════════════════════
  // STEP 6 — Create institute_user records (with extra_data)
  // ════════════════════════════════════════════════════════
  console.log('\n[6] Creating institute_user records...');
  let iuCount = 0;
  for (const s of students) {
    const dstUserId = userMap[s.srcId];
    const srcInstId = studentInst[s.srcId] || WINS_SRC;
    const dstInstId = instMap[srcInstId];
    const instName = srcInstId === WINS_SRC ? 'WINS' : 'Sihasma';
    const typeId = srcInstId === WINS_SRC ? winsStudentTypeId : sihasmaStudentTypeId;
    const statusMap = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', PENDING: 'PENDING', OLD: 'FORMER' };
    const iuStatus = statusMap[s.status] || 'ACTIVE';

    const extra = {};
    if (s.school)                extra.school = s.school;
    if (s.guardianName)          extra.guardianName = s.guardianName;
    if (s.guardianPhone)         extra.guardianPhone = s.guardianPhone;
    if (s.relationship)          extra.guardianRelationship = s.relationship;
    if (s.occupation)            extra.occupation = s.occupation;
    if (s.telephone)             extra.telephone = s.telephone;
    if (s.whatsappPhone)         extra.whatsappPhone = s.whatsappPhone;
    if (s.emergencyContactName)  extra.emergencyContactName = s.emergencyContactName;
    if (s.emergencyContactPhone) extra.emergencyContactPhone = s.emergencyContactPhone;
    if (s.barcodeId)             extra.barcodeId = s.barcodeId;
    extra.instituteName = instName;

    await dst.query(`INSERT IGNORE INTO institute_user
      (user_id, institute_id, user_id_institue, status, institute_user_type,
       primary_user_type_id, institute_card_id, image_verification_status,
       extra_data, institute_user_image_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'STUDENT', ?, ?, 'PENDING', ?, ?, ?, ?)`,
      [dstUserId, dstInstId, s.barcodeId || null, iuStatus,
       typeId, s.barcodeId || null,
       JSON.stringify(extra), s.avatarUrl || null, ts, ts]);

    iuCount++;
  }
  console.log('  institute_user records:', iuCount);

  // ════════════════════════════════════════════════════════
  // STEP 7 — Create classes
  // ════════════════════════════════════════════════════════
  console.log('\n[7] Creating classes...');
  const classMap = {}; // srcClassId -> new uuid
  for (const c of srcClasses) {
    const newClassId = uuid();
    classMap[c.id] = newClassId;
    const dstInstId = instMap[c.orgId];
    const instShort = c.orgId === WINS_SRC ? 'WINS' : 'Sihasma';
    const displayName = `${instShort} ${c.name}`;
    const safeCode = `${instShort}_${c.name.replace(/[^a-zA-Z0-9]/g,'_')}_${newClassId.slice(0,4)}`;

    await dst.query(`INSERT INTO institute_classes
      (id, name, code, class_type, description, is_active, enrollment_enabled,
       require_teacher_verification, teacher_commission_pct, created_at, updated_at, institute_id)
      VALUES (?, ?, ?, 'ACADEMIC', ?, 1, 0, 0, 0.00, ?, ?, ?)`,
      [newClassId, displayName, safeCode, c.description || null, ts, ts, dstInstId]);
    console.log('  Created:', displayName);
  }

  // ════════════════════════════════════════════════════════
  // STEP 8 — Enroll students
  // ════════════════════════════════════════════════════════
  console.log('\n[8] Enrolling students...');
  const [enrollments] = await src.query(`
    SELECT e.userId, e.classId, e.paymentType
    FROM Enrollment e
    JOIN Class c ON c.id = e.classId
    WHERE c.orgId IN (?, ?)
  `, [WINS_SRC, SIHASMA_SRC]);

  let eCount = 0;
  for (const e of enrollments) {
    const dstUserId = userMap[e.userId];
    const dstClassId = classMap[e.classId];
    if (!dstUserId || !dstClassId) continue;
    const srcClass = srcClasses.find(c => c.id === e.classId);
    const dstInstId = instMap[srcClass.orgId];
    const sType = e.paymentType === 'FREE' ? 'free_card' : e.paymentType === 'HALF' ? 'half_paid' : 'paid';

    await dst.query(`INSERT IGNORE INTO institute_class_students
      (student_user_id, institute_class_id, institute_id, is_active, is_verified,
       enrollment_method, student_type, created_at, updated_at)
      VALUES (?, ?, ?, 1, 1, 'MANUAL', ?, ?, ?)`,
      [dstUserId, dstClassId, dstInstId, sType, ts, ts]);
    eCount++;
  }
  console.log('  Enrollments:', eCount);

  // ════════════════════════════════════════════════════════
  // STEP 9 — Session groups (weeks)
  // ════════════════════════════════════════════════════════
  console.log('\n[9] Creating session groups...');
  const [srcWeeks] = await src.query(`
    SELECT w.id, w.classId, w.name, w.orderNo
    FROM ClassAttendanceWeek w
    JOIN Class c ON c.id = w.classId
    WHERE c.orgId IN (?, ?)
    ORDER BY w.classId, w.orderNo
  `, [WINS_SRC, SIHASMA_SRC]);

  const weekMap = {};
  let wCount = 0;
  for (const w of srcWeeks) {
    const dstClassId = classMap[w.classId];
    if (!dstClassId) continue;
    const srcClass = srcClasses.find(c => c.id === w.classId);
    const dstInstId = instMap[srcClass.orgId];
    const newWeekId = uuid();
    weekMap[w.id] = newWeekId;

    await dst.query(`INSERT INTO institute_class_attendance_session_groups
      (id, institute_id, class_id, name, display_order, is_active, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [newWeekId, dstInstId, dstClassId, w.name, w.orderNo, ADMIN_ID, ts, ts]);
    wCount++;
  }
  console.log('  Session groups:', wCount);

  // ════════════════════════════════════════════════════════
  // STEP 10 — Sessions (>5 marks only)
  // ════════════════════════════════════════════════════════
  console.log('\n[10] Migrating valid sessions (>5 marks)...');
  const [validSessions] = await src.query(`
    SELECT s.id, s.classId, s.date, s.sessionTime, s.sessionEndTime,
           s.weekId, s.sessionCode, COUNT(a.id) as attendCount
    FROM ClassAttendanceSession s
    JOIN Class c ON c.id = s.classId
    LEFT JOIN ClassAttendance a ON a.sessionCode = s.sessionCode
          AND a.classId = s.classId AND a.date = s.date
    WHERE c.orgId IN (?, ?)
    GROUP BY s.id
    HAVING COUNT(a.id) > 5
    ORDER BY s.classId, s.date
  `, [WINS_SRC, SIHASMA_SRC]);
  console.log('  Valid sessions:', validSessions.length);

  const sessionMap = {};
  // (classId|sessionCode|date) -> newSessionId for attendance lookup
  const sessionLookup = {};
  let sCount = 0;

  for (const s of validSessions) {
    const dstClassId = classMap[s.classId];
    if (!dstClassId) continue;
    const srcClass = srcClasses.find(c => c.id === s.classId);
    const dstInstId = instMap[srcClass.orgId];
    const newSessionId = uuid();
    sessionMap[s.id] = newSessionId;
    const dateStr = toDate(s.date);
    sessionLookup[`${s.classId}||${s.sessionCode}||${dateStr}`] = newSessionId;

    const dstGroupId = s.weekId ? (weekMap[s.weekId] || null) : null;
    const startTime = (s.sessionTime && s.sessionTime !== '00:00') ? s.sessionTime : '08:00';
    const endTime = (s.sessionEndTime && s.sessionEndTime !== '00:00') ? s.sessionEndTime : null;
    const sessionName = s.sessionCode || dateStr;

    await dst.query(`INSERT INTO institute_class_attendance_sessions
      (id, institute_id, class_id, session_group_id, name, date, start_time, end_time,
       is_closed, close_unmark_action, total_students, send_notifications,
       created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'KEEP_NOT_MARKED', ?, 0, ?, ?, ?)`,
      [newSessionId, dstInstId, dstClassId, dstGroupId, sessionName,
       dateStr, startTime, endTime, s.attendCount, ADMIN_ID, ts, ts]);
    sCount++;
  }
  console.log('  Sessions created:', sCount);

  // ════════════════════════════════════════════════════════
  // STEP 11 — Attendance records
  // ════════════════════════════════════════════════════════
  console.log('\n[11] Migrating attendance records...');

  let attTotal = 0;
  const tsMs = ts.getTime();

  // Group valid sessions by class for batched queries
  const byClass = {};
  for (const s of validSessions) {
    if (!byClass[s.classId]) byClass[s.classId] = [];
    byClass[s.classId].push(s);
  }

  for (const [srcClassId, sessList] of Object.entries(byClass)) {
    const srcClass = srcClasses.find(c => c.id === srcClassId);
    const dstInstId = instMap[srcClass.orgId];

    for (const sess of sessList) {
      const dateStr = toDate(sess.date);
      const newSessionId = sessionLookup[`${srcClassId}||${sess.sessionCode}||${dateStr}`];
      if (!newSessionId) continue;

      const [attRecords] = await src.query(`
        SELECT a.userId, a.status, a.note
        FROM ClassAttendance a
        WHERE a.classId = ? AND a.sessionCode = ?
      `, [srcClassId, sess.sessionCode]);

      if (attRecords.length === 0) continue;

      const rows = [];
      for (const a of attRecords) {
        const dstUserId = userMap[a.userId];
        if (!dstUserId) continue;

        const userIdStr = String(dstUserId);
        // dynamo_pk / dynamo_sk are required NOT NULL — use synthetic unique keys for migrated data
        const pk = `I#${dstInstId}`;
        const sk = `ATTENDANCE#${dateStr}#TS#${tsMs + attTotal + rows.length}#S#${userIdStr}#MIGRATED`;

        rows.push([
          pk, sk, dstInstId, userIdStr, dateStr,
          mapStatus(a.status), tsMs, null, null,
          a.note || null, 'MIGRATION', 'STUDENT',
          newSessionId, 'SYNCED', null, ts, ts
        ]);
      }

      if (rows.length === 0) continue;

      // Insert in chunks of 200
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        await dst.query(`INSERT IGNORE INTO attendance_records
          (dynamo_pk, dynamo_sk, institute_id, student_id, date,
           status, \`timestamp\`, class_id, subject_id,
           remarks, marking_method, user_type,
           class_session_id, sync_status, synced_at, created_at)
          VALUES ?`, [chunk.map(r => [r[0],r[1],r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13],r[14],r[15]])]);
      }
      attTotal += rows.length;
    }
    console.log(`  Class ${srcClass.name || srcClassId}: attendance done`);
  }
  console.log('  Total attendance records:', attTotal);

  await dst.query('SET FOREIGN_KEY_CHECKS = 1');
  await src.end();
  await dst.end();

  console.log('\n════ MIGRATION COMPLETE ════');
  console.log('Institutes : WINS, Sihasma');
  console.log('Students   :', uCount);
  console.log('Classes    :', Object.keys(classMap).length);
  console.log('Enrollments:', eCount);
  console.log('Sess groups:', wCount);
  console.log('Sessions   :', sCount);
  console.log('Attendance :', attTotal);
}

run().catch(e => { console.error('\nFATAL:', e.message, '\n', e.stack); process.exit(1); });
