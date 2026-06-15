/**
 * ============================================================
 *  SURAKSHA LMS — BULK ATTENDANCE INJECTOR (DevTools console)
 *  Paste into the browser DevTools console on the legacy attendance page
 *  (e.g. eclass.lk / winsonline.lk) that holds the DataTable of students.
 *
 *  Flow:
 *    1. Pick / confirm the Suraksha CLASS (listed from the API key's institute)
 *    2. Pick an existing SESSION  — OR generate a new one for that class
 *    3. Read attendance rows from the page's DataTable
 *    4. Send to Suraksha:  POST /api/external/v1/attendance/sessions/:id/mark-bulk
 *
 *  Auth: institute API key (Bearer). Institute is derived from the key.
 *  Scopes needed:  CLASS_READ (list/create), SESSION_CREATE (generate), ATTENDANCE_MARK (mark).
 *  No parent notifications are ever sent on these endpoints.
 * ============================================================
 */
(async function () {
  "use strict";

  // ─── CONFIG ──────────────────────────────────────────────────
  // You can either set API_KEY here, OR just paste it into the field in the UI.
  const SURAKSHA_API = "https://apilms.suraksha.lk";        // Suraksha backend base
  let   API_KEY      = "";                                   // optional — leave blank and type it in the panel
  // Institute is fixed by the API key — nothing to hardcode. Class/session chosen in the UI.
  // ─────────────────────────────────────────────────────────────

  const EP = {
    classes:    `${SURAKSHA_API}/api/external/v1/classes`,
    sessions:   (classId) => `${SURAKSHA_API}/api/external/v1/classes/${classId}/sessions`,
    markBulk:   (sessionId) => `${SURAKSHA_API}/api/external/v1/attendance/sessions/${sessionId}/mark-bulk`,
  };
  // Reads the key from the UI field if present, else the constant above.
  const getApiKey = () => {
    const f = document.getElementById("_bai_apikey");
    return (f && f.value.trim()) || API_KEY.trim();
  };
  const authHeaders = (json = true) => ({
    ...(json ? { "Content-Type": "application/json" } : {}),
    "Authorization": `Bearer ${getApiKey()}`,
  });

  // ── Suraksha status code map (matches backend resolveAutoStatus) ──
  //   0=Absent 1=Present 2=Late 3=Left 4=LeftEarly 5=LeftLately
  const STATUS_CODE = { ABSENT: 0, PRESENT: 1, LATE: 2, LEFT: 3, LEFTEARLY: 4, LEFTLATELY: 5 };

  // ── safeFetch — never throws on non-JSON ──
  async function safeFetch(url, options) {
    try {
      const res = await fetch(url, options);
      const rawText = await res.text();
      const trimmed = rawText.trimStart();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try { return { ok: res.ok, status: res.status, data: JSON.parse(rawText), rawText }; }
        catch (e) { return { ok: false, status: res.status, data: null, rawText, parseError: e.message }; }
      }
      return { ok: false, status: res.status, data: null, rawText, parseError: "Non-JSON response" };
    } catch (networkErr) {
      return { ok: false, status: 0, data: null, rawText: "", networkError: networkErr.message };
    }
  }

  // ── Auto-detect a date/time from the legacy page (best-effort) ──
  function detectFromPage() {
    const d = {};
    const allDates = [];
    document.querySelectorAll("h2, h3, .panel-body, .crumb-trail").forEach(el => {
      [...el.textContent.matchAll(/(\d{4}-\d{2}-\d{2})/g)].forEach(m => allDates.push(m[1]));
    });
    if (allDates.length) d.date = allDates[allDates.length - 1];
    document.querySelectorAll("h2").forEach(h => {
      const tm = h.textContent.match(/(\d{2}:\d{2})\s*-\s*\d{2}:/);
      if (tm && !d.time) d.time = tm[1];
    });
    return d;
  }

  // ── Read students from a DataTable (or DOM fallback) ──
  function readStudents() {
    const tableIds = ["#dt_cls_ses_sessions", "#dt_cls_students"];
    for (const tid of tableIds) {
      try {
        const table = window.$ && $(tid).DataTable();
        const rows = table.rows().data().toArray();
        if (rows.length) return { rows, source: tid };
      } catch (_) {}
    }
    try {
      const rows = [];
      document.querySelectorAll("#dt_cls_ses_sessions tbody tr").forEach(tr => {
        const c = tr.querySelectorAll("td");
        if (c.length >= 7) rows.push({
          student_id: c[0]?.textContent.trim(), cls_index_no: c[1]?.textContent.trim(),
          name: c[2]?.textContent.trim(), In: c[4]?.textContent.trim(),
          Out: c[5]?.textContent.trim(), is_present: c[6]?.textContent.trim(),
        });
      });
      if (rows.length) return { rows, source: "dom" };
    } catch (_) {}
    return { rows: [], source: "none" };
  }

  function mapStatus(raw) {
    if (!raw) return "NOTMARKED";
    const r = raw.toString().toLowerCase().replace(/<[^>]*>/g, "").trim();
    if (r.includes("present") && !r.includes("not") && !r.includes("absent")) return "PRESENT";
    if (r.includes("absent")) return "ABSENT";
    if (r.includes("late")) return "LATE";
    return "NOTMARKED";
  }

  function parseTimeFromCell(raw) {
    if (!raw) return null;
    const t = raw.toString().replace(/<[^>]*>/g, "").trim();
    if (!t || ["-", "—", "N/A"].includes(t)) return null;
    const mysql = t.match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})(?::\d{2})?/);
    if (mysql) return mysql[1];
    const plain = t.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
    if (plain) return plain[1];
    const any = t.match(/(\d{2}:\d{2})/);
    return any ? any[1] : null;
  }

  // Build ISO check-in time from a session date + HH:mm (backend stores it as the record timestamp).
  function buildCheckInISO(date, hhmm) {
    if (!date || !hhmm) return null;
    return `${date}T${hhmm}:00.000Z`;
  }

  const auto = detectFromPage();

  // ─── UI ───────────────────────────────────────────────────────
  const CSS = `
    #_bai_overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif}
    #_bai_box{background:#13161e;color:#e2e8f0;border-radius:14px;width:560px;max-width:96vw;padding:26px 28px;box-shadow:0 24px 80px rgba(0,0,0,.7);border:1px solid #252a38;max-height:92vh;overflow-y:auto}
    #_bai_box h2{margin:0 0 4px;font-size:17px;font-weight:700;color:#60a5fa}
    #_bai_box .sub{margin:0 0 16px;font-size:12px;color:#4b5563}
    ._f{margin-bottom:12px}
    ._f label{display:block;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.7px;margin-bottom:5px}
    ._f input,._f select{width:100%;box-sizing:border-box;background:#0d0f16;border:1px solid #252a38;border-radius:7px;color:#e2e8f0;font-size:13px;padding:8px 11px;outline:none}
    ._f input:focus,._f select:focus{border-color:#60a5fa}
    ._f small{display:block;font-size:11px;color:#374151;margin-top:3px}
    ._row{display:flex;gap:10px}._row ._f{flex:1}
    .btn{border:none;border-radius:8px;padding:9px 13px;font-size:12px;font-weight:700;cursor:pointer}
    .btn-b{background:#2563eb;color:#fff}.btn-b:hover{background:#1d4ed8}
    .btn-g{background:#1a1e2a;color:#9ca3af;border:1px solid #252a38}
    #_bai_info{background:#0d0f16;border:1px solid #252a38;border-radius:8px;padding:10px 13px;font-size:12px;color:#34d399;margin-bottom:14px;line-height:1.8}
    #_bai_actions{display:flex;gap:10px;margin-top:16px}
    #_bai_run{flex:1;background:#2563eb;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer}
    #_bai_run:disabled{background:#1e3a5f;cursor:not-allowed}
    #_bai_log{margin-top:14px;background:#080a0f;border-radius:8px;padding:11px;max-height:220px;overflow-y:auto;font-size:11px;font-family:monospace;display:none;border:1px solid #1a1e2a;line-height:1.7}
    #_bai_log .ok{color:#34d399}#_bai_log .err{color:#f87171}#_bai_log .inf{color:#60a5fa}#_bai_log .warn{color:#fbbf24}
    .newses{border:1px dashed #334155;border-radius:8px;padding:10px;margin-bottom:12px;display:none}
  `;
  if (!document.getElementById("_bai_css")) {
    const s = document.createElement("style"); s.id = "_bai_css"; s.textContent = CSS; document.head.appendChild(s);
  }
  document.getElementById("_bai_overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "_bai_overlay";
  overlay.innerHTML = `
    <div id="_bai_box">
      <h2>⚡ Suraksha Bulk Attendance</h2>
      <p class="sub">Enter API key → Load classes → pick/generate session → push rows</p>
      <div id="_bai_info">🔑 Paste your institute API key, then click <b>Load classes</b>.</div>

      <div class="_row">
        <div class="_f" style="flex:1">
          <label>Institute API Key * (CLASS_READ + SESSION_CREATE + ATTENDANCE_MARK)</label>
          <input id="_bai_apikey" type="password" placeholder="paste API key" value="${API_KEY}">
        </div>
        <div class="_f" style="flex:0 0 auto;align-self:flex-end">
          <button id="_bai_loadclasses" class="btn btn-b" type="button">Load classes</button>
        </div>
      </div>

      <div class="_f">
        <label>Class *</label>
        <select id="_bai_class"><option value="">— enter key &amp; load —</option></select>
      </div>

      <div class="_row">
        <div class="_f">
          <label>Session *</label>
          <select id="_bai_session"><option value="">— pick a class first —</option></select>
        </div>
        <div class="_f" style="flex:0 0 auto;align-self:flex-end">
          <button id="_bai_newtoggle" class="btn btn-g" type="button">+ New session</button>
        </div>
      </div>

      <div class="newses" id="_bai_newses">
        <div class="_row">
          <div class="_f"><label>Name *</label><input id="_bai_ns_name" placeholder="e.g. Migrated 2026-03-01"></div>
          <div class="_f"><label>Date *</label><input id="_bai_ns_date" type="date" value="${auto.date || ""}"></div>
        </div>
        <div class="_row">
          <div class="_f"><label>Start *</label><input id="_bai_ns_start" type="time" value="${auto.time || "08:00"}"></div>
          <div class="_f"><label>End</label><input id="_bai_ns_end" type="time"></div>
        </div>
        <button id="_bai_ns_create" class="btn btn-b" type="button">Generate session</button>
      </div>

      <div class="_f">
        <label>Check-in time source</label>
        <select id="_bai_time_src">
          <option value="page" selected>Use "In" time from page per student</option>
          <option value="fixed">Use a fixed time for all</option>
          <option value="none">Don't send check-in time</option>
        </select>
      </div>
      <div class="_f" id="_bai_fixed_wrap" style="display:none">
        <label>Fixed check-in time</label>
        <input id="_bai_fixed_time" type="time" value="${auto.time || "08:00"}">
      </div>

      <div class="_f">
        <label>Status</label>
        <select id="_bai_status">
          <option value="__page__" selected>Use status from page per student</option>
          <option value="PRESENT">PRESENT — all</option>
          <option value="ABSENT">ABSENT — all</option>
          <option value="LATE">LATE — all</option>
        </select>
      </div>

      <div id="_bai_log"></div>
      <div id="_bai_actions">
        <button id="_bai_cancel" class="btn btn-g">✕ Close</button>
        <button id="_bai_run">🚀 Send Attendance</button>
      </div>
    </div>`;
  (document.body || document.documentElement).appendChild(overlay);
  console.log("%c⚡ Suraksha panel rendered — look top-center of the page.", "color:#34d399;font-weight:bold");

  const $id = (id) => document.getElementById(id);
  const logEl = $id("_bai_log");
  const addLog = (msg, type = "inf") => {
    logEl.style.display = "block";
    const d = document.createElement("div"); d.className = type;
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight;
  };

  $id("_bai_cancel").onclick = () => overlay.remove();
  $id("_bai_newtoggle").onclick = () => {
    const el = $id("_bai_newses");
    el.style.display = el.style.display === "block" ? "none" : "block";
  };
  $id("_bai_time_src").onchange = (e) => {
    $id("_bai_fixed_wrap").style.display = e.target.value === "fixed" ? "block" : "none";
  };

  // ── Load classes (triggered by the button) ──
  const sessionsCache = {}; // classId -> { date } per sessionId, for check-in date
  async function loadClasses() {
    if (!getApiKey()) { addLog("Enter the API key first.", "err"); $id("_bai_info").innerHTML = "❌ API key is required."; return; }
    const sel = $id("_bai_class");
    sel.innerHTML = `<option value="">— loading… —</option>`;
    $id("_bai_info").innerHTML = "⏳ Loading classes…";
    const r = await safeFetch(EP.classes, { headers: authHeaders(false) });
    if (!r.ok) {
      sel.innerHTML = `<option value="">— failed —</option>`;
      $id("_bai_info").innerHTML = `❌ Failed to load classes (HTTP ${r.status}). Check the key / CLASS_READ scope / CORS.`;
      addLog(`Class load failed: ${r.parseError || r.networkError || ("HTTP " + r.status)}`, "err");
      if (r.rawText) addLog(`   server said: ${r.rawText.slice(0, 160).replace(/\s+/g, " ")}`, "warn");
      return;
    }
    const classes = Array.isArray(r.data) ? r.data : (r.data.data || []);
    sel.innerHTML = `<option value="">— select class —</option>` +
      classes.map(c => `<option value="${c.id}">${c.name}${c.code ? " (" + c.code + ")" : ""}</option>`).join("");
    $id("_bai_info").innerHTML = `🔑 Institute resolved from API key. <b>${classes.length}</b> classes loaded.`;
    addLog(`Loaded ${classes.length} classes`, "ok");
  }
  $id("_bai_loadclasses").onclick = loadClasses;
  // If a key was hardcoded in CONFIG, load immediately for convenience.
  if (API_KEY.trim()) loadClasses();

  // ── Load sessions when class changes ──
  async function loadSessions(classId) {
    const sel = $id("_bai_session");
    sel.innerHTML = `<option value="">— loading… —</option>`;
    const r = await safeFetch(EP.sessions(classId), { headers: authHeaders(false) });
    if (!r.ok) {
      sel.innerHTML = `<option value="">— failed to load —</option>`;
      addLog(`Session load failed: ${r.parseError || r.networkError || r.status}`, "err");
      return;
    }
    const sessions = Array.isArray(r.data) ? r.data : (r.data.data || []);
    sessionsCache[classId] = {};
    sessions.forEach(s => { sessionsCache[classId][s.id] = s.date; });
    sel.innerHTML = `<option value="">— select session —</option>` +
      sessions.map(s => `<option value="${s.id}">${s.name} · ${s.date}${s.isClosed ? " · CLOSED" : ""}</option>`).join("");
    addLog(`Loaded ${sessions.length} sessions`, "ok");
  }

  $id("_bai_class").onchange = (e) => { if (e.target.value) loadSessions(e.target.value); };

  // ── Generate a new session ──
  $id("_bai_ns_create").onclick = async () => {
    const classId = $id("_bai_class").value;
    if (!classId) { addLog("Pick a class first.", "err"); return; }
    const body = {
      name: $id("_bai_ns_name").value.trim(),
      date: $id("_bai_ns_date").value.trim() || undefined,
      startTime: $id("_bai_ns_start").value.trim(),
      endTime: $id("_bai_ns_end").value.trim() || undefined,
    };
    if (!body.name || !body.startTime) { addLog("Session name and start time are required.", "err"); return; }

    addLog(`Generating session "${body.name}"…`, "inf");
    const r = await safeFetch(EP.sessions(classId), { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    if (!r.ok) {
      addLog(`❌ Create failed (${r.status}): ${r.data?.message || r.parseError || r.rawText.slice(0, 120)}`, "err");
      return;
    }
    const s = r.data;
    addLog(`✅ Session created: ${s.id} (${s.date})`, "ok");
    // Refresh list and select the new one
    await loadSessions(classId);
    $id("_bai_session").value = s.id;
    $id("_bai_newses").style.display = "none";
  };

  // ── Send attendance ──
  $id("_bai_run").onclick = async () => {
    const classId   = $id("_bai_class").value;
    const sessionId = $id("_bai_session").value;
    const timeSrc   = $id("_bai_time_src").value;
    const fixedTime = $id("_bai_fixed_time").value.trim();
    const statusOpt = $id("_bai_status").value;

    if (!classId || !sessionId) { addLog("❌ Select both class and session.", "err"); return; }

    const sessionDate = sessionsCache[classId]?.[sessionId] || auto.date || null;

    const { rows, source } = readStudents();
    if (!rows.length) { addLog('❌ No rows in DataTable. Set page length to "All" first.', "err"); return; }
    addLog(`📋 ${rows.length} rows from ${source}`, "inf");

    const records = [];
    const skipped = [];
    rows.forEach(row => {
      const legacyId = String(row["student_id"] || "").replace(/<[^>]*>/g, "").trim();
      if (!legacyId || legacyId === "0") { skipped.push(row); return; }

      const statusName = statusOpt === "__page__"
        ? mapStatus(row["is_present"] || row["status"] || "")
        : statusOpt;
      const status = STATUS_CODE[statusName] ?? STATUS_CODE.PRESENT;

      let checkInTime = null;
      if (timeSrc === "page") {
        const hhmm = parseTimeFromCell(row["check_in_at"] || row["In"] || "") || fixedTime || null;
        checkInTime = buildCheckInISO(sessionDate, hhmm);
      } else if (timeSrc === "fixed" && fixedTime) {
        checkInTime = buildCheckInISO(sessionDate, fixedTime);
      }

      // studentId may be the LEGACY id (stored as userIdByInstitute during student
      // migration) OR the Suraksha user id — the backend resolves either within the
      // institute. Students not enrolled in the class come back in `failures` (CSV).
      const rec = { studentId: legacyId, status };
      if (checkInTime) rec.checkInTime = checkInTime;
      records.push(rec);
    });

    if (skipped.length) addLog(`⚠ Skipped ${skipped.length} rows (empty id)`, "warn");
    if (!records.length) { addLog("❌ No valid records.", "err"); return; }

    addLog(`📤 Sending ${records.length} records → session ${sessionId}`, "inf");
    addLog(`   sample: ${JSON.stringify(records[0])}`, "inf");
    $id("_bai_run").disabled = true; $id("_bai_run").textContent = "⏳ Sending…";

    const r = await safeFetch(EP.markBulk(sessionId), {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ records }),
    });

    if (!r.ok) {
      addLog(`❌ API ${r.status}: ${r.data?.message || r.parseError || r.rawText.slice(0, 160)}`, "err");
    } else {
      const d = r.data;
      addLog(`✅ Done — ✔ ${d.successCount} / ✘ ${d.failedCount}`, "ok");
      (d.failures || []).slice(0, 25).forEach(f => addLog(`   FAILED [${f.studentId}]: ${f.reason}`, "err"));
      if ((d.failures || []).length > 25) addLog(`   …and ${d.failures.length - 25} more`, "warn");

      if (d.failures?.length) {
        try {
          const csv = ["studentId,reason", ...d.failures.map(f =>
            `${String(f.studentId).replace(/,/g, ";")},${String(f.reason || "").replace(/[,\n]/g, " ")}`)].join("\n");
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
          a.download = `suraksha_attendance_failed_${sessionDate || "export"}.csv`;
          a.click(); URL.revokeObjectURL(a.href);
          addLog(`📥 Failures downloaded as CSV`, "warn");
        } catch (e) { addLog(`⚠ CSV failed: ${e.message}`, "warn"); }
      }
    }

    console.group("🎯 Suraksha bulk attendance");
    console.log("session:", sessionId, "class:", classId, "date:", sessionDate);
    console.log("response:", r);
    console.groupEnd();

    $id("_bai_run").disabled = false; $id("_bai_run").textContent = "🚀 Send Again";
  };

  console.log("%c⚡ Suraksha Bulk Attendance Injector loaded", "color:#3b82f6;font-size:14px;font-weight:bold");
})().catch(err => {
  // Never fail silently — if anything above throws, show it.
  console.error("❌ Suraksha Attendance Injector failed to start:", err);
  try { alert("Attendance Injector failed to start — see console for the error:\n\n" + (err && err.message ? err.message : err)); } catch (_) {}
});
