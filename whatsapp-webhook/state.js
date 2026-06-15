'use strict';

/**
 * In-memory conversation state store.
 *
 * State shape per phone number:
 * {
 *   step: 'AWAIT_STUDENT_CHOICE',   // current step in the flow
 *   userId: string,
 *   userType: string,
 *   children: [{ userId, firstName, lastName }],  // parent only
 *   expiresAt: number,  // epoch ms — evict after TTL
 * }
 *
 * Steps:
 *   AWAIT_STUDENT_CHOICE  — parent has been shown child list, waiting for reply
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes of conversation inactivity

const sessions = new Map();

// Evict stale sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of sessions) {
    if (val.expiresAt <= now) sessions.delete(key);
  }
}, 5 * 60 * 1000).unref();

function get(phone) {
  const s = sessions.get(phone);
  if (!s) return null;
  if (s.expiresAt <= Date.now()) {
    sessions.delete(phone);
    return null;
  }
  return s;
}

function set(phone, data) {
  sessions.set(phone, { ...data, expiresAt: Date.now() + TTL_MS });
}

function clear(phone) {
  sessions.delete(phone);
}

module.exports = { get, set, clear };
