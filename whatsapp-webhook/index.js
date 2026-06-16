'use strict';

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const wa = require('./whatsapp');

const app = express();

// Parse raw body so we can verify Meta's HMAC signature before touching the JSON.
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

/**
 * Verify the X-Hub-Signature-256 header Meta sends on every POST.
 * If WHATSAPP_APP_SECRET is unset we skip verification (dev mode only).
 */
function verifyMetaSignature(req) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true; // skip in dev — warn on startup

  const sig = req.headers['x-hub-signature-256'];
  if (!sig || !sig.startsWith('sha256=')) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  // Constant-time comparison prevents timing attacks
  return sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// ─── Trigger words ────────────────────────────────────────────────────────────
const GREETING_PATTERN = /^(hi|hello|me|මෙ|හායි|හෙලෝ)$/iu;

// OTP message: "OTP 123456", "OTP123456", or a bare 6-digit code.
const OTP_PATTERN = /\b(\d{6})\b/;
const OTP_PREFIX_PATTERN = /otp/i;

// ─── Attendance status labels ─────────────────────────────────────────────────
const STATUS_LABEL = {
  0: 'Absent',
  1: 'Present',
  2: 'Late',
  3: 'Left',
  4: 'Left Early',
  5: 'Left Lately',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(code) {
  return STATUS_LABEL[code] ?? 'Unknown';
}

/**
 * Build a human-readable attendance summary for last 7 days.
 * @param {Array} records  rows from getAttendanceLast7Days
 * @param {string} studentName
 * @param {string} instituteName
 */
function buildAttendanceMessage(records, studentName, instituteName) {
  const header = `📋 *${studentName}* — Last 7 Days Attendance\n🏫 ${instituteName}\n${'─'.repeat(30)}`;

  if (records.length === 0) {
    return `${header}\n\nNo attendance records found for this period.`;
  }

  const lines = records.map((r) => {
    const emoji = r.status === 1 ? '✅' : r.status === 2 ? '⏰' : '❌';
    return `${emoji} ${r.date}  ${statusLabel(r.status)}`;
  });

  const presentCount = records.filter((r) => r.status === 1 || r.status === 2).length;
  const footer = `\n📊 Present ${presentCount}/${records.length} days`;

  return `${header}\n\n${lines.join('\n')}${footer}`;
}

// ─── Core flow handlers ───────────────────────────────────────────────────────

/**
 * Handle a greeting from a registered student (USER or USER_WITHOUT_PARENT).
 * Sends last 7-days attendance immediately.
 */
async function handleStudent(from, user) {
  const institutes = await db.findStudentInstitutes(user.id);

  if (institutes.length === 0) {
    await wa.sendText(from, '⚠️ You are enrolled in no active institute. Please contact your institute admin.');
    return;
  }

  // Use first (or only) institute; most students belong to one
  const inst = institutes[0];
  const records = await db.getAttendanceLast7Days(user.id, inst.instituteId);
  const name = `${user.firstName} ${user.lastName}`.trim();
  const msg = buildAttendanceMessage(records, name, inst.instituteName);

  await wa.sendText(from, msg);
}

/**
 * Send a child's last-7-day attendance. Shared by the parent + selection flows.
 */
async function sendChildAttendance(from, child) {
  const institutes = await db.findStudentInstitutes(child.userId);
  if (institutes.length === 0) {
    await wa.sendText(from, `⚠️ ${child.firstName} is not enrolled in any active institute.`);
    return;
  }
  const inst = institutes[0];
  const records = await db.getAttendanceLast7Days(child.userId, inst.instituteId);
  const name = `${child.firstName} ${child.lastName}`.trim();
  await wa.sendText(from, buildAttendanceMessage(records, name, inst.instituteName));
}

/**
 * Handle a greeting from a registered parent (USER_WITHOUT_STUDENT).
 *
 * STATELESS: instead of remembering a "waiting for choice" session, we send a
 * tappable WhatsApp list where each row's id is `child:<userId>`. When the
 * parent taps one, the reply carries that id back to us (handleChildSelection),
 * so nothing has to be stored server-side. A typed fallback also works.
 */
async function handleParent(from, user) {
  const children = await db.findChildrenOfParent(user.id);

  if (children.length === 0) {
    await wa.sendText(
      from,
      '⚠️ No students are linked to your account.\nPlease contact your institute admin to link your child.',
    );
    return;
  }

  // Single child — skip selection, just send it.
  if (children.length === 1) {
    await sendChildAttendance(from, children[0]);
    return;
  }

  // Multiple children — tappable list. Friendly title; the row id carries the
  // child's user id and is access-checked by sender phone on tap (a parent can
  // only resolve children actually linked to their own account).
  const rows = children.map((c, i) => {
    const name = `${c.firstName} ${c.lastName}`.trim() || `Student ${i + 1}`;
    return {
      id: `child:${c.userId}`,
      title: `${c.firstName || name} — Attendance`.slice(0, 24),
      description: name,
    };
  });

  const res = await wa.sendList(
    from,
    '👋 Hello! Tap below to choose a student and view their attendance.',
    'Choose student',
    rows,
    'Your students',
  );

  // Fallback to a numbered text menu if the interactive send failed
  // (e.g. older client). The parent can reply with the number.
  if (!res.success) {
    const lines = children.map((c, i) => `${i + 1}. ${c.firstName} ${c.lastName}`);
    await wa.sendText(
      from,
      `👋 Hello! Reply with the *number* of the student whose attendance you want:\n\n${lines.join('\n')}`,
    );
  }
}

/**
 * Resolve a parent's child selection — works for BOTH:
 *   • an interactive list tap  → selectionId = "child:<userId>"
 *   • a typed number           → selectionId = "3"
 * Re-queries the parent's children by phone (stateless), so it always matches
 * the same deterministic order the list was built from.
 * Returns true if handled.
 */
async function handleChildSelection(from, selectionId) {
  // Interactive row id: child:<userId>
  const idMatch = /^child:(\d+)$/.exec(selectionId.trim());
  // Typed number fallback: "2"
  const numMatch = /^([1-9]\d?)$/.exec(selectionId.trim());
  if (!idMatch && !numMatch) return false;

  const user = await db.findUserByPhone(from);
  if (!user || user.userType !== 'USER_WITHOUT_STUDENT') return false;

  const children = await db.findChildrenOfParent(user.id);
  if (children.length === 0) return false;

  let child;
  if (idMatch) {
    child = children.find((c) => String(c.userId) === idMatch[1]);
  } else {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= children.length) child = children[n - 1];
  }

  if (!child) {
    await wa.sendText(from, '⚠️ That student is no longer linked to your account. Send *hi* to see the current list.');
    return true;
  }

  await sendChildAttendance(from, child);
  return true;
}

// ─── Main message dispatcher ──────────────────────────────────────────────────

/**
 * Try to confirm an OTP carried in this message.
 * Returns true if the message was an OTP attempt (handled), false otherwise.
 *
 * Binding is enforced in db.confirm* — the sender phone (`from`) must equal the
 * phone the OTP was issued for. We try the registration/phone-verify table
 * first, then password-reset.
 */
async function handleOtpMessage(from, text) {
  const looksLikeOtp = OTP_PREFIX_PATTERN.test(text) || OTP_PATTERN.test(text);
  if (!looksLikeOtp) return false;

  const match = text.match(OTP_PATTERN);
  if (!match) return false;
  const code = match[1];

  // Try phone-verification / phone-change OTPs first.
  let result = await db.confirmUserOtp(code, from);
  if (result === 'not_found') {
    // Then password-reset OTPs.
    result = await db.confirmPasswordResetOtp(code, from);
  }

  if (result === 'verified') {
    await wa.sendText(from, '✅ Verified! Please return to the website and click *Next* to continue.');
    return true;
  }
  if (result === 'mismatch') {
    await wa.sendText(
      from,
      '⚠️ This code was issued for a different phone number. For security, send the code from the phone you are verifying.',
    );
    return true;
  }
  // not_found in both tables — could be an expired/used code, or just a number
  // in a normal message. Only respond if it was clearly an OTP attempt.
  if (OTP_PREFIX_PATTERN.test(text)) {
    await wa.sendText(from, '❌ Invalid or expired code. Please request a new code on the website.');
    return true;
  }
  return false;
}

async function handleIncomingMessage(from, text, interactiveId) {
  const trimmed = (text || '').trim();

  // 1) Interactive list tap (parent chose a child). Fully stateless — the row
  //    id carries the child's user id.
  if (interactiveId) {
    const handled = await handleChildSelection(from, interactiveId);
    if (handled) return;
  }

  // 2) OTP confirmation — a user sending "OTP 123456" is never a greeting.
  const handledAsOtp = await handleOtpMessage(from, trimmed);
  if (handledAsOtp) return;

  // 3) Typed child-selection fallback (parent replied "2" instead of tapping).
  if (await handleChildSelection(from, trimmed)) return;

  // Only respond to trigger words — ignore everything else
  if (!GREETING_PATTERN.test(trimmed)) {
    return;
  }

  // Look up sender by phone number (the ONLY allowed lookup method)
  const user = await db.findUserByPhone(from);

  if (!user) {
    await wa.sendText(from, 'You are not registered.');
    return;
  }

  const { userType } = user;

  // USER_WITHOUT_STUDENT = parent-only role
  if (userType === 'USER_WITHOUT_STUDENT') {
    await handleParent(from, user);
    return;
  }

  // USER, USER_WITHOUT_PARENT = student-capable roles
  if (userType === 'USER' || userType === 'USER_WITHOUT_PARENT') {
    await handleStudent(from, user);
    return;
  }

  // Any other role (admin, teacher, etc.) — not served by this bot
  await wa.sendText(
    from,
    '⚠️ Your account type does not have attendance access via WhatsApp.\nPlease use the Suraksha LMS app.',
  );
}

// ─── Webhook endpoints ────────────────────────────────────────────────────────

// GET — Meta verification challenge
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[webhook] Verified by Meta');
    return res.status(200).send(challenge);
  }

  console.warn('[webhook] Verification failed — token mismatch');
  res.sendStatus(403);
});

// POST — incoming messages
app.post('/webhook', async (req, res) => {
  // Reject requests that don't carry a valid Meta HMAC signature.
  if (!verifyMetaSignature(req)) {
    console.warn('[webhook] Rejected — invalid X-Hub-Signature-256');
    return res.sendStatus(403);
  }

  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const messages = value?.messages;
        if (!messages || messages.length === 0) continue;

        for (const msg of messages) {
          const from = msg.from; // sender's phone number (digits, no +)
          let text = '';
          let interactiveId; // row id from a tapped list / button reply

          if (msg.type === 'text') {
            text = msg.text?.body || '';
          } else if (msg.type === 'interactive') {
            // Tappable list / reply-button selections carry their id here.
            const it = msg.interactive || {};
            interactiveId = it.list_reply?.id || it.button_reply?.id || '';
            text = it.list_reply?.title || it.button_reply?.title || '';
          } else {
            continue; // ignore media/location/etc.
          }

          console.log(`[msg] from=${from} type=${msg.type} text="${text}" id="${interactiveId || ''}"`);

          // Process async — errors must not bubble up past here
          handleIncomingMessage(from, text, interactiveId).catch((err) => {
            console.error(`[msg] Error handling message from ${from}:`, err);
          });
        }
      }
    }
  } catch (err) {
    console.error('[webhook] Unexpected error:', err);
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`[suraksha-wa-webhook] Listening on port ${PORT}`);
  if (!process.env.WHATSAPP_APP_SECRET) {
    console.warn('[security] WHATSAPP_APP_SECRET is not set — Meta signature verification is DISABLED');
  }
  if (!process.env.WHATSAPP_VERIFY_TOKEN) {
    console.warn('[security] WHATSAPP_VERIFY_TOKEN is not set — webhook GET verification will fail');
  }
});
