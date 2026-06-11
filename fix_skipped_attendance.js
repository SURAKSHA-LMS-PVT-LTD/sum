/**
 * Fixes the 10 skipped sessions that had duplicate sessionCodes.
 * Strategy: for duplicate sessionCodes, match dst session by picking the one
 * whose date is closest to the source session's date (toDate of UTC timestamp).
 */
require('./lms-api-suraksha-lk/node_modules/dotenv').config({ path: './lms-api-suraksha-lk/.env' });
const mysql = require('./lms-api-suraksha-lk/node_modules/mysql2/promise');
const ts = new Date();

function toDate(d) { return new Date(d).toISOString().slice(0, 10); }
function mapStatus(s) { return s === 'PRESENT' ? 1 : 0; }
function dayDiff(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

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

  await dst.query('SET FOREIGN_KEY_CHECKS = 0');

  // ── Institutes
  const [dstInstitutes] = await dst.query(`SELECT id, name FROM institutes WHERE name IN ('WINS', 'Sihasma')`);
  const instNameMap = {};
  for (const i of dstInstitutes) instNameMap[i.name] = i.id;
  const instMap = { [WINS_SRC]: instNameMap['WINS'], [SIHASMA_SRC]: instNameMap['Sihasma'] };
  const dstInstIds = [instNameMap['WINS'], instNameMap['Sihasma']];

  // ── Src classes
  const [srcClasses] = await src.query(`SELECT id, name, orgId FROM Class WHERE orgId IN (?, ?)`, [WINS_SRC, SIHASMA_SRC]);

  // ── Class map
  const [dstClasses] = await dst.query(`SELECT id, name, institute_id FROM institute_classes`);
  const classMap = {};
  for (const sc of srcClasses) {
    const dstInstId = instMap[sc.orgId];
    const instShort = sc.orgId === WINS_SRC ? 'WINS' : 'Sihasma';
    const dc = dstClasses.find(d => d.name === `${instShort} ${sc.name}` && d.institute_id === dstInstId);
    if (dc) classMap[sc.id] = dc.id;
  }

  // ── User map
  const [srcStudents] = await src.query(`
    SELECT DISTINCT u.id as srcId, u.email, p.barcodeId, p.phone
    FROM User u JOIN Profile p ON p.userId = u.id
    JOIN Enrollment e ON e.userId = u.id JOIN Class c ON c.id = e.classId
    WHERE c.orgId IN (?, ?)
  `, [WINS_SRC, SIHASMA_SRC]);

  const [dstIUsers] = await dst.query(`
    SELECT u.id as dstId, u.email, u.phone_number, iu.extra_data
    FROM users u JOIN institute_user iu ON iu.user_id = u.id
    WHERE iu.institute_id IN (?, ?)
  `, dstInstIds);

  const emailToDst = {}, phoneToDst = {}, barcodeToDst = {};
  for (const du of dstIUsers) {
    if (du.email) emailToDst[du.email.toLowerCase()] = du.dstId;
    if (du.phone_number) phoneToDst[du.phone_number] = du.dstId;
    try { const ex = JSON.parse(du.extra_data||'{}'); if (ex.barcodeId) barcodeToDst[ex.barcodeId] = du.dstId; } catch {}
  }
  const userMap = {};
  for (const s of srcStudents) {
    let dstId = null;
    if (s.email && s.email.includes('@')) dstId = emailToDst[s.email.toLowerCase()];
    if (!dstId && s.phone) dstId = phoneToDst[s.phone];
    if (!dstId && s.barcodeId) dstId = barcodeToDst[s.barcodeId];
    if (dstId) userMap[s.srcId] = dstId;
  }

  // ── Dst sessions indexed by dstClassId+name
  const [dstSessions] = await dst.query(
    `SELECT id, class_id, date, name FROM institute_class_attendance_sessions WHERE institute_id IN (?, ?)`, dstInstIds
  );
  const dstSessionIdx = {};
  for (const ds of dstSessions) {
    const key = `${ds.class_id}||${ds.name}`;
    if (!dstSessionIdx[key]) dstSessionIdx[key] = [];
    dstSessionIdx[key].push({ id: ds.id, date: toDate(ds.date) });
  }

  // ── The skipped sessions from source (duplicates only)
  const [dupSessions] = await src.query(`
    SELECT s.id, s.classId, s.date, s.sessionCode, COUNT(a.id) as attendCount
    FROM ClassAttendanceSession s
    JOIN Class c ON c.id = s.classId
    LEFT JOIN ClassAttendance a ON a.sessionCode = s.sessionCode AND a.classId = s.classId AND a.date = s.date
    WHERE c.orgId IN (?, ?)
    GROUP BY s.id HAVING COUNT(a.id) > 5
    ORDER BY s.classId, s.date
  `, [WINS_SRC, SIHASMA_SRC]);

  // Filter to only sessions where there are multiple candidates and we'd have skipped
  const skipped = dupSessions.filter(sess => {
    const dstClassId = classMap[sess.classId];
    const candidates = dstSessionIdx[`${dstClassId}||${sess.sessionCode}`] || [];
    const dateStr = toDate(sess.date);
    const exact = candidates.find(c => c.date === dateStr);
    return !exact && candidates.length > 1;
  });

  console.log('Skipped sessions to fix:', skipped.length);

  // Track which dst session IDs have already been claimed by a src session
  // so we don't link two src sessions to the same dst session
  const claimedDstSessions = new Set();

  // First, mark dst sessions that are already claimed (exact match ones)
  for (const sess of dupSessions) {
    const dstClassId = classMap[sess.classId];
    const candidates = dstSessionIdx[`${dstClassId}||${sess.sessionCode}`] || [];
    const dateStr = toDate(sess.date);
    const exact = candidates.find(c => c.date === dateStr);
    if (exact) claimedDstSessions.add(exact.id);
  }

  let attTotal = 0;
  const tsMs = ts.getTime();

  for (const sess of skipped) {
    const dateStr = toDate(sess.date);
    const dstClassId = classMap[sess.classId];
    const dstInstId = instMap[srcClasses.find(c => c.id === sess.classId).orgId];
    const candidates = (dstSessionIdx[`${dstClassId}||${sess.sessionCode}`] || [])
      .filter(c => !claimedDstSessions.has(c.id));

    if (candidates.length === 0) {
      console.log(`  NO UNCLAIMED candidates for ${sess.sessionCode} on ${dateStr}`);
      continue;
    }

    // Pick closest date
    let best = candidates[0];
    for (const c of candidates) {
      if (dayDiff(c.date, dateStr) < dayDiff(best.date, dateStr)) best = c;
    }
    claimedDstSessions.add(best.id);

    console.log(`  ${sess.sessionCode} | src:${dateStr} -> dst:${best.date} (diff:${dayDiff(best.date,dateStr).toFixed(1)}d) | id:${best.id}`);

    const [attRecords] = await src.query(`
      SELECT a.userId, a.status, a.note FROM ClassAttendance a
      WHERE a.classId = ? AND a.sessionCode = ?
    `, [sess.classId, sess.sessionCode]);

    const rows = [];
    for (const a of attRecords) {
      const dstUserId = userMap[a.userId];
      if (!dstUserId) continue;
      const userIdStr = String(dstUserId);
      const pk = `I#${dstInstId}`;
      const sk = `ATTENDANCE#${dateStr}#TS#${tsMs + attTotal + rows.length}#S#${userIdStr}#MIGRATED2`;
      rows.push([
        pk, sk, dstInstId, userIdStr, dateStr,
        mapStatus(a.status), tsMs, null, null,
        a.note || null, 'MIGRATION', 'STUDENT',
        best.id, 'SYNCED', null, ts, ts
      ]);
    }

    if (rows.length === 0) continue;

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

  const [[total]] = await dst.query(`SELECT COUNT(*) as cnt FROM attendance_records WHERE marking_method LIKE 'MIGRATION%'`);
  console.log(`\nRecords added this run: ${attTotal}`);
  console.log(`Total migrated attendance records in DB: ${total.cnt}`);

  await dst.query('SET FOREIGN_KEY_CHECKS = 1');
  await src.end();
  await dst.end();
}

run().catch(console.error);
