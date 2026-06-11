/**
 * Re-runs only the attendance records migration step.
 * Queries dst sessions directly by class_id + name to avoid key mismatch.
 * Fix: attendance query uses classId + sessionCode only (no date filter).
 */
require('./lms-api-suraksha-lk/node_modules/dotenv').config({ path: './lms-api-suraksha-lk/.env' });
const mysql = require('./lms-api-suraksha-lk/node_modules/mysql2/promise');
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

  await dst.query('SET FOREIGN_KEY_CHECKS = 0');

  // ── Load source classes
  const [srcClasses] = await src.query(
    `SELECT id, name, orgId FROM Class WHERE orgId IN (?, ?)`,
    [WINS_SRC, SIHASMA_SRC]
  );

  // ── Load dst institutes
  const [dstInstitutes] = await dst.query(
    `SELECT id, name FROM institutes WHERE name IN ('WINS', 'Sihasma')`
  );
  const instNameMap = {};
  for (const i of dstInstitutes) instNameMap[i.name] = i.id;
  const instMap = {
    [WINS_SRC]: instNameMap['WINS'],
    [SIHASMA_SRC]: instNameMap['Sihasma'],
  };
  console.log('Institutes:', instNameMap);

  // ── Map src class -> dst class
  const [dstClasses] = await dst.query(
    `SELECT id, name, institute_id FROM institute_classes`
  );
  const classMap = {}; // srcClassId -> dstClassId
  for (const sc of srcClasses) {
    const dstInstId = instMap[sc.orgId];
    const instShort = sc.orgId === WINS_SRC ? 'WINS' : 'Sihasma';
    const expectedName = `${instShort} ${sc.name}`;
    const dc = dstClasses.find(d => d.name === expectedName && d.institute_id === dstInstId);
    if (dc) classMap[sc.id] = dc.id;
  }
  console.log('Class map keys:', Object.keys(classMap).length);

  // ── Build userMap: src userId -> dst userId
  const [srcStudents] = await src.query(`
    SELECT DISTINCT u.id as srcId, u.email, p.barcodeId, p.phone
    FROM User u
    JOIN Profile p ON p.userId = u.id
    JOIN Enrollment e ON e.userId = u.id
    JOIN Class c ON c.id = e.classId
    WHERE c.orgId IN (?, ?)
  `, [WINS_SRC, SIHASMA_SRC]);

  const dstInstIds = [instNameMap['WINS'], instNameMap['Sihasma']];
  const [dstIUsers] = await dst.query(`
    SELECT u.id as dstId, u.email, u.phone_number, iu.extra_data
    FROM users u
    JOIN institute_user iu ON iu.user_id = u.id
    WHERE iu.institute_id IN (?, ?)
  `, dstInstIds);

  const emailToDst = {};
  const phoneToDst = {};
  const barcodeToDst = {};
  for (const du of dstIUsers) {
    if (du.email) emailToDst[du.email.toLowerCase()] = du.dstId;
    if (du.phone_number) phoneToDst[du.phone_number] = du.dstId;
    try {
      const ex = JSON.parse(du.extra_data || '{}');
      if (ex.barcodeId) barcodeToDst[ex.barcodeId] = du.dstId;
    } catch {}
  }
  const userMap = {};
  for (const s of srcStudents) {
    let dstId = null;
    if (s.email && s.email.includes('@')) dstId = emailToDst[s.email.toLowerCase()];
    if (!dstId && s.phone) dstId = phoneToDst[s.phone];
    if (!dstId && s.barcodeId) dstId = barcodeToDst[s.barcodeId];
    if (dstId) userMap[s.srcId] = dstId;
  }
  console.log(`User map: ${Object.keys(userMap).length} / ${srcStudents.length}`);

  // ── Get valid sessions from source
  const [validSessions] = await src.query(`
    SELECT s.id, s.classId, s.date, s.sessionCode, COUNT(a.id) as attendCount
    FROM ClassAttendanceSession s
    JOIN Class c ON c.id = s.classId
    LEFT JOIN ClassAttendance a ON a.sessionCode = s.sessionCode
          AND a.classId = s.classId AND a.date = s.date
    WHERE c.orgId IN (?, ?)
    GROUP BY s.id HAVING COUNT(a.id) > 5
    ORDER BY s.classId, s.date
  `, [WINS_SRC, SIHASMA_SRC]);
  console.log('Valid sessions:', validSessions.length);

  // ── Load ALL dst sessions for WINS+Sihasma indexed by dstClassId+name
  const [dstSessions] = await dst.query(
    `SELECT id, class_id, date, name FROM institute_class_attendance_sessions WHERE institute_id IN (?, ?)`,
    dstInstIds
  );
  // dstClassId|name -> [{id, date}] (array because same name can appear multiple times with diff dates)
  const dstSessionIdx = {};
  for (const ds of dstSessions) {
    const key = `${ds.class_id}||${ds.name}`;
    if (!dstSessionIdx[key]) dstSessionIdx[key] = [];
    dstSessionIdx[key].push({ id: ds.id, date: toDate(ds.date) });
  }

  // ── Migrate attendance records
  console.log('\nMigrating attendance records...');
  let attTotal = 0;
  let skipped = 0;
  const tsMs = ts.getTime();

  const byClass = {};
  for (const s of validSessions) {
    if (!byClass[s.classId]) byClass[s.classId] = [];
    byClass[s.classId].push(s);
  }

  for (const [srcClassId, sessList] of Object.entries(byClass)) {
    const srcClass = srcClasses.find(c => c.id === srcClassId);
    const dstClassId = classMap[srcClassId];
    const dstInstId = instMap[srcClass.orgId];

    for (const sess of sessList) {
      const dateStr = toDate(sess.date);

      // Find matching dst session: same dstClassId + sessionCode name, pick the one whose date matches
      const key = `${dstClassId}||${sess.sessionCode}`;
      const candidates = dstSessionIdx[key] || [];
      let dstSess = candidates.find(c => c.date === dateStr);
      if (!dstSess && candidates.length === 1) dstSess = candidates[0]; // only one, use it
      if (!dstSess) {
        console.log(`  SKIP: ${sess.sessionCode} on ${dateStr} (${candidates.length} candidates)`);
        skipped++;
        continue;
      }
      const newSessionId = dstSess.id;

      // Query attendance by classId + sessionCode (no date filter — timezone offset issue)
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
    console.log(`  Class ${srcClass.name}: done`);
  }

  console.log(`\nTotal attendance records migrated: ${attTotal} (skipped sessions: ${skipped})`);

  await dst.query('SET FOREIGN_KEY_CHECKS = 1');
  await src.end();
  await dst.end();
}

run().catch(console.error);
