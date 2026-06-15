'use strict';

require('dotenv').config();

const express = require('express');
const db = require('./db');
const wa = require('./whatsapp');
const state = require('./state');

const app = express();
app.use(express.json());

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
 * Handle a greeting from a registered parent (USER_WITHOUT_STUDENT).
 * Lists children; waits for the parent to pick one.
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

  // Save state so we know we're waiting for child selection
  state.set(from, {
    step: 'AWAIT_STUDENT_CHOICE',
    userId: user.id,
    userType: user.userType,
    children,
  });

  const lines = children.map((c, i) => `${i + 1}. ${c.firstName} ${c.lastName}`);
  const msg =
    `👋 Hello! Please reply with the *number* of the student whose attendance you want to view:\n\n` +
    lines.join('\n') +
    `\n\nReply *0* to cancel.`;

  await wa.sendText(from, msg);
}

/**
 * Handle the parent's student selection reply.
 */
async function handleStudentChoice(from, text, session) {
  const trimmed = text.trim();

  if (trimmed === '0') {
    state.clear(from);
    await wa.sendText(from, '✅ Cancelled. Send *hi* any time to start again.');
    return;
  }

  const choice = parseInt(trimmed, 10);
  const { children } = session;

  if (isNaN(choice) || choice < 1 || choice > children.length) {
    const lines = children.map((c, i) => `${i + 1}. ${c.firstName} ${c.lastName}`);
    await wa.sendText(
      from,
      `Please reply with a number between 1 and ${children.length}:\n\n${lines.join('\n')}\n\nReply *0* to cancel.`,
    );
    return;
  }

  const child = children[choice - 1];
  state.clear(from);

  const institutes = await db.findStudentInstitutes(child.userId);
  if (institutes.length === 0) {
    await wa.sendText(from, `⚠️ ${child.firstName} is not enrolled in any active institute.`);
    return;
  }

  const inst = institutes[0];
  const records = await db.getAttendanceLast7Days(child.userId, inst.instituteId);
  const name = `${child.firstName} ${child.lastName}`.trim();
  const msg = buildAttendanceMessage(records, name, inst.instituteName);

  await wa.sendText(from, msg);
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

async function handleIncomingMessage(from, text) {
  const trimmed = text.trim();

  // 1) OTP confirmation takes priority — a user sending "OTP 123456" is never
  //    a greeting or a child-selection reply.
  const handledAsOtp = await handleOtpMessage(from, trimmed);
  if (handledAsOtp) return;

  // Check if this sender is mid-conversation (parent selecting a child)
  const session = state.get(from);
  if (session && session.step === 'AWAIT_STUDENT_CHOICE') {
    await handleStudentChoice(from, trimmed, session);
    return;
  }

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
          // Only handle text messages
          if (msg.type !== 'text') continue;

          const from = msg.from; // sender's phone number (digits, no +)
          const text = msg.text?.body || '';

          console.log(`[msg] from=${from} text="${text}"`);

          // Process async — errors must not bubble up past here
          handleIncomingMessage(from, text).catch((err) => {
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
});
