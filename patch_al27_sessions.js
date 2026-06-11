/**
 * Patch: migrate missing AL27 sessions + attendance for WINS institute.
 * The original migration missed these because ClassAttendance.sessionCode
 * uses a different format than ClassAttendanceSession.sessionCode.
 * This script matches attendance by classId + date only.
 */
require('./lms-api-suraksha-lk/node_modules/dotenv').config({ path: './lms-api-suraksha-lk/.env' });
const mysql = require('./lms-api-suraksha-lk/node_modules/mysql2/promise');
const crypto = require('crypto');

function uuid() { return crypto.randomUUID(); }
function toDate(d) {
  if (!d) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date(d));
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

  await dst.query('SET FOREIGN_KEY_CHECKS = 0');

  const SRC_CLASS_AL27 = '085e6528-db3b-489a-80b8-97133d6aa7cf';
  const DST_CLASS_AL27 = '29c42a3e-0ba3-4b74-9ccd-e03723d41ad8';
  const DST_INST      = '6e09518a-89ac-47e1-8961-326b5fd5fc9c';
  const ADMIN_ID      = 1;
  const ts            = new Date();
  const tsMs          = ts.getTime();

  // ── 1. Build week map: src weekId -> dst session_group_id ──────────────────
  // Load existing dst session groups for this class
  const [dstGroups] = await dst.query(
    'SELECT id, name FROM institute_class_attendance_session_groups WHERE class_id=?',
    [DST_CLASS_AL27]
  );
  const dstGroupByName = Object.fromEntries(dstGroups.map(g => [g.name, g.id]));
  console.log('Existing dst groups:', Object.keys(dstGroupByName).join(', ') || '(none)');

  // Load src weeks
  const [srcWeeks] = await src.query(
    'SELECT id, name, orderNo FROM ClassAttendanceWeek WHERE classId=? ORDER BY orderNo',
    [SRC_CLASS_AL27]
  );
  const weekMap = {}; // srcWeekId -> dstGroupId
  for (const w of srcWeeks) {
    if (dstGroupByName[w.name]) {
      weekMap[w.id] = dstGroupByName[w.name];
    } else {
      // Create missing group
      const newId = uuid();
      await dst.query(
        `INSERT INTO institute_class_attendance_session_groups
         (id, institute_id, class_id, name, display_order, is_active, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [newId, DST_INST, DST_CLASS_AL27, w.name, w.orderNo, ADMIN_ID, ts, ts]
      );
      weekMap[w.id] = newId;
      dstGroupByName[w.name] = newId;
      console.log('  Created group:', w.name, '->', newId);
    }
  }

  // ── 2. Load all source sessions ────────────────────────────────────────────
  const [srcSessions] = await src.query(
    `SELECT id, date, sessionCode, weekId, sessionTime, sessionEndTime
     FROM ClassAttendanceSession WHERE classId=? ORDER BY date ASC`,
    [SRC_CLASS_AL27]
  );

  // ── 3. Load already-migrated dst sessions (by date) ───────────────────────
  const [dstSessions] = await dst.query(
    'SELECT date FROM institute_class_attendance_sessions WHERE class_id=?',
    [DST_CLASS_AL27]
  );
  const migratedDates = new Set(dstSessions.map(s => toDate(s.date)));
  console.log('Already migrated dates:', [...migratedDates].join(', '));

  // ── 4. Build user map: src userId -> dst userId ───────────────────────────
  // Get all src student IDs that have attendance in this class
  const [srcAttUsers] = await src.query(
    'SELECT DISTINCT userId FROM ClassAttendance WHERE classId=?',
    [SRC_CLASS_AL27]
  );
  const srcUserIds = srcAttUsers.map(r => r.userId);

  // Load their emails from src
  const [srcUsers] = await src.query(
    `SELECT u.id, u.email, p.phone FROM User u LEFT JOIN Profile p ON p.userId=u.id WHERE u.id IN (?)`,
    [srcUserIds.length ? srcUserIds : [0]]
  );
  const srcEmailMap = Object.fromEntries(srcUsers.map(u => [u.id, { email: u.email, phone: u.phone }]));

  // Match to dst users by email or phone
  const userMap = {}; // srcUserId -> dstUserId
  for (const [srcId, info] of Object.entries(srcEmailMap)) {
    if (info.email) {
      const [[dstUser]] = await dst.query('SELECT id FROM users WHERE email=? LIMIT 1', [info.email]);
      if (dstUser) { userMap[srcId] = dstUser.id; continue; }
    }
    if (info.phone) {
      const [[dstUser]] = await dst.query('SELECT id FROM users WHERE phone_number=? LIMIT 1', [info.phone]);
      if (dstUser) { userMap[srcId] = dstUser.id; continue; }
    }
  }
  console.log(`User map: ${Object.keys(userMap).length} of ${srcUserIds.length} matched`);

  // ── 5. For each src session, migrate if not already present ───────────────
  let sessCreated = 0, attTotal = 0, skipped = 0;

  for (const sess of srcSessions) {
    const dateStr = toDate(sess.date);

    if (migratedDates.has(dateStr)) {
      console.log(`  SKIP (exists): ${dateStr} ${sess.sessionCode}`);
      skipped++;
      continue;
    }

    // Count attendance for this session (join by date only — sessionCode formats differ)
    const [[{ cnt }]] = await src.query(
      'SELECT COUNT(*) as cnt FROM ClassAttendance WHERE classId=? AND date=?',
      [SRC_CLASS_AL27, sess.date]
    );
    console.log(`  Session ${dateStr} ${sess.sessionCode}: ${cnt} attendance records`);

    const dstGroupId = sess.weekId ? (weekMap[sess.weekId] || null) : null;
    const startTime  = (sess.sessionTime   && sess.sessionTime   !== '00:00') ? sess.sessionTime   : '08:00';
    const endTime    = (sess.sessionEndTime && sess.sessionEndTime !== '00:00') ? sess.sessionEndTime : null;
    const newSessId  = uuid();

    await dst.query(
      `INSERT INTO institute_class_attendance_sessions
       (id, institute_id, class_id, session_group_id, name, date, start_time, end_time,
        is_closed, close_unmark_action, total_students, send_notifications,
        created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'KEEP_NOT_MARKED', ?, 0, ?, ?, ?)`,
      [newSessId, DST_INST, DST_CLASS_AL27, dstGroupId,
       sess.sessionCode, dateStr, startTime, endTime,
       cnt, ADMIN_ID, ts, ts]
    );
    sessCreated++;

    if (cnt === 0) continue;

    // Load attendance records for this date
    const [attRecords] = await src.query(
      'SELECT userId, status, note FROM ClassAttendance WHERE classId=? AND date=?',
      [SRC_CLASS_AL27, sess.date]
    );

    const rows = [];
    for (const a of attRecords) {
      const dstUserId = userMap[a.userId];
      if (!dstUserId) continue;
      const pk = `I#${DST_INST}`;
      const sk = `ATTENDANCE#${dateStr}#TS#${tsMs + attTotal + rows.length}#S#${dstUserId}#MIGRATED`;
      rows.push([
        pk, sk, DST_INST, String(dstUserId), dateStr,
        mapStatus(a.status), tsMs + rows.length, null, null,
        a.note || null, 'MIGRATION', 'STUDENT',
        newSessId, 'SYNCED', null, ts
      ]);
    }

    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      await dst.query(
        `INSERT IGNORE INTO attendance_records
         (dynamo_pk, dynamo_sk, institute_id, student_id, date,
          status, \`timestamp\`, class_id, subject_id,
          remarks, marking_method, user_type,
          class_session_id, sync_status, synced_at, created_at)
         VALUES ?`,
        [chunk.map(r => [r[0],r[1],r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13],r[14],r[15]])]
      );
    }
    attTotal += rows.length;
    console.log(`    -> inserted ${rows.length} attendance records`);
  }

  await dst.query('SET FOREIGN_KEY_CHECKS = 1');
  await src.end();
  await dst.end();

  console.log('\n════ PATCH COMPLETE ════');
  console.log('Sessions created :', sessCreated);
  console.log('Sessions skipped :', skipped, '(already existed)');
  console.log('Attendance records:', attTotal);
}

run().catch(e => { console.error('\nFATAL:', e.message, '\n', e.stack); process.exit(1); });
