/**
 * Migrate admin@td.lk from thilinadhananjaya_lms to suraksha-lms-db
 * as INSTITUTE_ADMIN for Thilina Dhananjaya Academy (id = 6e09518a-89ac-47e1-8961-326b5fd5fc9c)
 */
require('./lms-api-suraksha-lk/node_modules/dotenv').config({ path: './lms-api-suraksha-lk/.env' });
const mysql = require('./lms-api-suraksha-lk/node_modules/mysql2/promise');
const crypto = require('crypto');

const INSTITUTE_ID = '6e09518a-89ac-47e1-8961-326b5fd5fc9c';

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

  try {
    // 1. Fetch admin@td.lk from source
    const [srcRows] = await src.query(
      `SELECT u.id, u.email, u.password, p.fullName, p.phone
       FROM User u LEFT JOIN Profile p ON p.userId = u.id
       WHERE u.email = 'admin@td.lk' LIMIT 1`
    );
    if (!srcRows.length) { console.error('admin@td.lk not found in source'); return; }
    const srcUser = srcRows[0];
    console.log('Source user:', { id: srcUser.id, email: srcUser.email, fullName: srcUser.fullName });

    // 2. Check if user already exists in dst
    const [existingUser] = await dst.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [srcUser.email]);
    let dstUserId;

    if (existingUser.length) {
      dstUserId = existingUser[0].id;
      console.log('User already exists in dst, id =', dstUserId);
    } else {
      // 3. Create user in dst (id is auto-increment bigint)
      const [insertResult] = await dst.query(
        `INSERT INTO users (email, first_name, phone_number, password, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
        [srcUser.email, srcUser.fullName || 'Thilina Dhananjaya', srcUser.phone || null, srcUser.password || '']
      );
      dstUserId = insertResult.insertId;
      console.log('Created user in dst, id =', dstUserId);
    }

    // 4. Check if already institute member
    const [existingIU] = await dst.query(
      `SELECT institute_user_type FROM institute_user WHERE user_id = ? AND institute_id = ? LIMIT 1`,
      [dstUserId, INSTITUTE_ID]
    );

    if (existingIU.length) {
      if (existingIU[0].institute_user_type !== 'INSTITUTE_ADMIN') {
        await dst.query(
          `UPDATE institute_user SET institute_user_type = 'INSTITUTE_ADMIN', updated_at = NOW()
           WHERE user_id = ? AND institute_id = ?`,
          [dstUserId, INSTITUTE_ID]
        );
        console.log('Updated existing institute_user to INSTITUTE_ADMIN for user_id =', dstUserId);
      } else {
        console.log('Already INSTITUTE_ADMIN for user_id =', dstUserId);
      }
    } else {
      // 5. Insert institute_user as INSTITUTE_ADMIN
      await dst.query(
        `INSERT INTO institute_user (user_id, institute_id, institute_user_type, status, created_at, updated_at)
         VALUES (?, ?, 'INSTITUTE_ADMIN', 'ACTIVE', NOW(), NOW())`,
        [dstUserId, INSTITUTE_ID]
      );
      console.log('Created institute_user INSTITUTE_ADMIN for user_id =', dstUserId);
    }

    console.log('Done. admin@td.lk is now INSTITUTE_ADMIN for institute', INSTITUTE_ID);
  } finally {
    await src.end();
    await dst.end();
  }
}

run().catch(console.error);
