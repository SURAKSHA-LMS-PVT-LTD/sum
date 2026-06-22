'use strict';

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const wa = require('./whatsapp');
const i18n = require('./i18n');

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
  if (!appSecret) {
    // Fail CLOSED in production — a missing secret must never accept
    // unauthenticated payloads. Only an explicit dev override may bypass.
    const allowUnverified =
      process.env.NODE_ENV !== 'production' &&
      process.env.WHATSAPP_WEBHOOK_ALLOW_UNVERIFIED === 'true';
    if (allowUnverified) return true;
    console.error('[security] WHATSAPP_APP_SECRET not set — rejecting payload (fail-closed)');
    return false;
  }

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
const GREETING_PATTERN = /^(hi|hello|hey|good\s*morning|good\s*afternoon|good\s*evening|good\s*night|me|මෙ|හායි|හෙලෝ|ආයුබෝවන්|සුභ\s*උදෑසනක්|வணக்கம்|காலை\s*வணக்கம்)$/iu;

const LOGO_URL = process.env.WA_LOGO_URL || 'https://suraksha.lk/assets/logos/surakshalms-logo.png';

// OTP message: "OTP 123456", "OTP123456", or a bare 6-digit code.
const OTP_PATTERN = /\b(\d{6})\b/;
const OTP_PREFIX_PATTERN = /otp/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the best display name: name_with_initials → first+last → fallback. */
function displayName(u, fallback = 'You') {
  const ni = (u.nameWithInitials || '').trim();
  if (ni) return ni;
  const fl = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return fl || fallback;
}

/** Context phrase for one record — names kept in English as stored. */
function recordContext(r) {
  const sub = (r.subjectName || '').trim();
  const cls = (r.className || '').trim();
  const inst = (r.instituteName || '').trim();
  if (sub && cls) return `${sub} (${cls})`;
  if (cls) return inst ? `${cls} @ ${inst}` : cls;
  if (inst) return inst;
  return '';
}

/**
 * Build the attendance reply for the LATEST 10 records, localized, always
 * ending with the contact's "Your Suraksha LMS user ID is <id>" line.
 *
 * @param {Array}  records      rows from getAttendanceLast10 (date,status,names)
 * @param {string} studentName  whose attendance this is (English as stored)
 * @param {string} lang         'S' | 'E' | 'T'
 * @param {string} recipientId  the CONTACT's (phone owner's) LMS user id
 */
function buildAttendanceMessage(records, studentName, lang, recipientId) {
  const s = i18n.t(lang);
  const header = s.historyHeader(studentName);
  const footer = `\n\n${s.userIdLine(recipientId)}`;

  if (!records || records.length === 0) {
    return `${header}\n\n${s.noRecords}${footer}`;
  }

  const lines = records.map((r) => {
    const status = Number(r.status);
    const emoji = status === 1 ? '✅' : status === 2 ? '⏰' : status === 0 ? '❌' : '⏱️';
    const ctx = recordContext(r);
    const label = i18n.statusLabel(lang, status);
    return ctx
      ? `${emoji} ${r.date} — ${label} · ${ctx}`
      : `${emoji} ${r.date} — ${label}`;
  });

  const present = records.filter((r) => Number(r.status) === 1 || Number(r.status) === 2).length;
  const summary = `\n\n${s.summary(present, records.length)}`;

  return `${header}\n\n${lines.join('\n')}${summary}${footer}`;
}

// ─── Core flow handlers ───────────────────────────────────────────────────────

/**
 * Send a menu with the logo image as the header.
 * Uses interactive BUTTONS (image header supported, max 3) when rows ≤ 3,
 * falls back to the plain LIST (text header only) when rows > 3.
 * Button/list replies both arrive as interactive.button_reply / list_reply,
 * and handleMenuSelection already handles both id shapes.
 */
async function sendMenuWithLogo(from, lang, rows) {
  const s = i18n.t(lang);

  if (rows.length <= 3) {
    // Button titles: use name-with-initials (Latin script, ≤20 chars).
    // Names like "H.M.K.S. Perera" fit comfortably; truncate at 20 if needed.
    const buttons = rows.map((r) => ({
      id: r.id,
      title: (r.description || r.title).slice(0, 20),
    }));
    const res = await wa.sendButtonMenu(from, LOGO_URL, s.menuBody, buttons);
    if (!res.success) {
      const lines = rows.map((r, i) => `${i + 1}. ${r.description || r.title}`);
      await wa.sendText(from, `${s.typedFallbackIntro}\n\n${lines.join('\n')}`);
    }
    return;
  }

  // > 3 rows — scrollable list (no image header, but titles support Unicode)
  const res = await wa.sendList(from, s.menuBody, s.menuButton, rows, s.menuHeader);
  if (!res.success) {
    const lines = rows.map((r, i) => `${i + 1}. ${r.description || r.title}`);
    await wa.sendText(from, `${s.typedFallbackIntro}\n\n${lines.join('\n')}`);
  }
}

/**
 * Handle a greeting from a registered student (USER or USER_WITHOUT_PARENT).
 * Shows logo + "My Attendance" button in a single message.
 */
async function handleStudent(from, user, lang) {
  const s = i18n.t(lang);
  const name = displayName(user);
  const rows = [{
    id: 'self:attendance',
    title: s.rowAttendanceSuffix.slice(0, 20),
    description: name,
  }];
  await sendMenuWithLogo(from, lang, rows);
}

/**
 * Send a child's LATEST 10 attendance records. The footer user-id and language
 * are the CONTACT's (the parent who messaged us), not the child's.
 *
 * @param {object} contact  the phone owner (parent) — drives id + language
 */
async function sendChildAttendance(from, child, contact, lang) {
  const records = await db.getAttendanceLast10(child.userId);
  const name = displayName(child, 'Student');
  await wa.sendText(from, buildAttendanceMessage(records, name, lang, contact.id));
}

/**
 * Handle a greeting from a registered parent (USER_WITHOUT_STUDENT).
 *
 * STATELESS: instead of remembering a "waiting for choice" session, we send a
 * tappable WhatsApp list where each row's id is `child:<userId>`. When the
 * parent taps one, the reply carries that id back to us (handleChildSelection),
 * so nothing has to be stored server-side. A typed fallback also works.
 */
async function handleParent(from, user, lang) {
  const s = i18n.t(lang);
  const children = await db.findChildrenOfParent(user.id);

  if (children.length === 0) {
    await wa.sendImage(from, LOGO_URL, s.noChildren);
    return;
  }

  // Always show the menu — even for a single child — so the parent consciously
  // taps to request attendance rather than receiving it unprompted on every "hi".
  const rows = children.map((c, i) => {
    const name = displayName(c, `Student ${i + 1}`);
    return {
      id: `child:${c.userId}`,
      title: `${name} — ${s.rowAttendanceSuffix}`.slice(0, 20),
      description: name,
    };
  });

  await sendMenuWithLogo(from, lang, rows);
}

/**
 * Resolve a parent's child selection — works for BOTH:
 *   • an interactive list tap  → selectionId = "child:<userId>"
 *   • a typed number           → selectionId = "3"
 * Re-queries the parent's children by phone (stateless), so it always matches
 * the same deterministic order the list was built from.
 * Returns true if handled.
 */
async function handleMenuSelection(from, selectionId) {
  const trimmed = selectionId.trim();

  // Student tapped "My Attendance" row
  if (trimmed === 'self:attendance') {
    const user = await db.findUserByPhone(from);
    if (!user) return false;
    if (user.userType !== 'USER' && user.userType !== 'USER_WITHOUT_PARENT') return false;
    const lang = i18n.resolveLang(user.language);
    const records = await db.getAttendanceLast10(user.id);
    const name = displayName(user);
    await wa.sendText(from, buildAttendanceMessage(records, name, lang, user.id));
    return true;
  }

  // Parent tapped a child row: child:<userId>
  const idMatch = /^child:(\d+)$/.exec(trimmed);
  // Typed number fallback: "1", "2", …
  const numMatch = /^([1-9]\d?)$/.exec(trimmed);
  if (!idMatch && !numMatch) return false;

  const user = await db.findUserByPhone(from);
  if (!user) return false;

  const lang = i18n.resolveLang(user.language);

  // Typed "1" could be a student (only one row in their menu)
  if (numMatch && (user.userType === 'USER' || user.userType === 'USER_WITHOUT_PARENT')) {
    if (parseInt(numMatch[1], 10) === 1) {
      const records = await db.getAttendanceLast10(user.id);
      const name = displayName(user);
      await wa.sendText(from, buildAttendanceMessage(records, name, lang, user.id));
      return true;
    }
    return false;
  }

  if (user.userType !== 'USER_WITHOUT_STUDENT') return false;

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
    await wa.sendText(from, i18n.t(lang).childRemoved);
    return true;
  }

  await sendChildAttendance(from, child, user, lang);
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

  // 1) Interactive list tap (self or child row). Fully stateless — the row
  //    id carries the context.
  if (interactiveId) {
    const handled = await handleMenuSelection(from, interactiveId);
    if (handled) return;
  }

  // 2) OTP confirmation — a user sending "OTP 123456" is never a greeting.
  const handledAsOtp = await handleOtpMessage(from, trimmed);
  if (handledAsOtp) return;

  // 3) Typed number fallback (user replied "1" instead of tapping).
  if (await handleMenuSelection(from, trimmed)) return;

  // Only respond to trigger words — ignore everything else
  if (!GREETING_PATTERN.test(trimmed)) {
    return;
  }

  // Look up sender by phone number (the ONLY allowed lookup method)
  const user = await db.findUserByPhone(from);

  if (!user) {
    // Unknown number — reply in default language (Sinhala).
    await wa.sendText(from, i18n.t('S').notRegistered);
    return;
  }

  const lang = i18n.resolveLang(user.language);
  const { userType } = user;

  // USER_WITHOUT_STUDENT = parent-only role
  if (userType === 'USER_WITHOUT_STUDENT') {
    await handleParent(from, user, lang);
    return;
  }

  // USER, USER_WITHOUT_PARENT = student-capable roles
  if (userType === 'USER' || userType === 'USER_WITHOUT_PARENT') {
    await handleStudent(from, user, lang);
    return;
  }

  // Any other role (admin, teacher, etc.) — not served by this bot
  await wa.sendText(from, i18n.t(lang).noWaAccess);
}

// ─── Webhook endpoints ────────────────────────────────────────────────────────

/**
 * Shared verification handler — Meta sends the challenge to whatever URL is
 * configured in the developer console. Some configurations hit `/` (root) and
 * some hit `/webhook`, so we handle both.
 */
function handleVerification(req, res) {
  // Meta sends both `hub.mode` and `hub_mode` (underscore variant) — accept either.
  const mode = req.query['hub.mode'] || req.query['hub_mode'];
  const token = req.query['hub.verify_token'] || req.query['hub_verify_token'];
  const challenge = req.query['hub.challenge'] || req.query['hub_challenge'];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[webhook] Verified by Meta ✓');
    return res.status(200).send(challenge);
  }

  console.warn(`[webhook] Verification failed — expected "${verifyToken}", got "${token}"`);
  res.sendStatus(403);
}

// GET — Meta verification challenge (root path — Meta hits this when the webhook URL has no path)
app.get('/', handleVerification);

// GET — Meta verification challenge (explicit /webhook path)
app.get('/webhook', handleVerification);

// POST — incoming messages (handles both root and /webhook path)
async function handleWebhookPost(req, res) {
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
}

app.post('/', handleWebhookPost);
app.post('/webhook', handleWebhookPost);

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
