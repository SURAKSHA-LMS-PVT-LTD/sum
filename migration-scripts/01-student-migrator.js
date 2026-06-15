/**
 * ============================================================
 *  SURAKSHA LMS — STUDENT MIGRATOR (winsonline.lk → Suraksha)
 *  Paste into the browser DevTools console while logged in to winsonline.lk.
 *
 *  A UI panel appears (top-center). Paste your API key, set options, paste the
 *  legacy student IDs, optionally pick a class, then click Migrate. Each student
 *  detail page is scraped and sent to:
 *      POST /api/external/v1/students/bulk   (scope: STUDENT_CREATE)
 *  Class list loads from CLASS_READ (optional, for the dropdown).
 *
 *  Auth: institute API key (Bearer). Institute is derived from the key.
 *
 *  NOTE: the "Institute password" = INSTITUTE (tenant) login password → maps to
 *        `institutePassword` (stored as institute_password, NOT user.password).
 * ============================================================
 */
(async function () {
  "use strict";

  // ─── CONFIG (all overridable in the UI) ──────────────────────
  const SURAKSHA_API = "https://apilms.suraksha.lk";   // Suraksha backend base
  let   API_KEY      = "";                             // optional — leave blank and type it in the panel
  // Legacy (winsonline.lk) scrape defaults
  const DEFAULT_CLASS_ID_OLD = "353";
  const BASE_URL     = "https://winsonline.lk/wins/index.php/classes/CLS_Students_C/show_cls_student_details";
  // Batch + pacing
  const BATCH_SIZE   = 25;
  const DELAY_MIN_MS = 1500;
  const DELAY_MAX_MS = 4000;
  // ─────────────────────────────────────────────────────────────

  const EP = {
    classes:  `${SURAKSHA_API}/api/external/v1/classes`,
    students: `${SURAKSHA_API}/api/external/v1/students/bulk`,
  };
  const getApiKey = () => {
    const f = document.getElementById("_sm_apikey");
    return (f && f.value.trim()) || API_KEY.trim();
  };
  const authHeaders = (json = true) => ({
    ...(json ? { "Content-Type": "application/json" } : {}),
    "Authorization": `Bearer ${getApiKey()}`,
  });

  const randomDelay = () => new Promise(r =>
    setTimeout(r, Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS));

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

  // ─── HELPER : PARSE LEGACY DETAIL PAGE ───────────────────────
  const parseStudentPage = (html, studentId) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const wrapper = doc.querySelector("#cls_student_detail_wrapper");
    if (!wrapper) throw new Error("Detail wrapper not found — wrong page / logged out / invalid id");

    const heading = wrapper.querySelector(".media-heading");
    const name = heading ? heading.textContent.trim().replace(/\s+/g, " ") : "";
    const gender = wrapper.querySelector(".fa-female") ? "FEMALE" : "MALE";

    let dob = "";
    const dobIcon = wrapper.querySelector(".fa-birthday-cake");
    if (dobIcon?.parentElement) dob = dobIcon.parentElement.textContent.trim();

    let school = "";
    const schoolIcon = wrapper.querySelector(".fa-institution");
    if (schoolIcon?.parentElement) {
      const raw = schoolIcon.parentElement.textContent.trim();
      school = raw.toLowerCase().includes("not mentioned") ? "" : raw;
    }

    const panels = wrapper.querySelectorAll(".panel-body");
    const leftPanel = panels[0] || wrapper;

    let address = "";
    const addrH5 = [...leftPanel.querySelectorAll("h5")].find(h =>
      h.textContent.trim().toLowerCase().startsWith("address"));
    if (addrH5) {
      const small = addrH5.querySelector("small");
      if (small) address = small.innerHTML.split(/<br\s*\/?>/i)
        .map(s => s.replace(/<[^>]+>/g, "").trim()).filter(Boolean).join(", ");
    }

    const allMobiles = [...leftPanel.querySelectorAll("h5")]
      .filter(h => h.textContent.trim().toLowerCase().startsWith("mobile"))
      .map(h => h.querySelector("small")?.textContent.trim() || "");
    const studentMobile = allMobiles[0] || "";
    const guardianMobile = allMobiles[1] || "";

    const parentNameH5 = [...leftPanel.querySelectorAll("h5")].find(h =>
      h.textContent.trim().toLowerCase().startsWith("name"));
    const guardianName = parentNameH5 ? (parentNameH5.querySelector("small")?.textContent.trim() || "") : "";

    let paymentType = "FULL";
    const feeH5 = [...leftPanel.querySelectorAll("h5")].find(h =>
      h.textContent.trim().toLowerCase().startsWith("fee"));
    if (feeH5) {
      const feeText = feeH5.textContent.toLowerCase();
      if (feeText.includes("free")) paymentType = "FREE";
      else if (feeText.includes("half")) paymentType = "HALF";
    }

    const parts = name.split(" ").filter(Boolean);
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] || `Student${studentId}`);
    const lastName  = parts.length > 1 ? parts[parts.length - 1] : "";

    return { studentId, name, firstName, lastName, gender, dob: dob || null,
             school, address, mobile: studentMobile, guardianMobile, guardianName, paymentType };
  };

  // ─── UI ───────────────────────────────────────────────────────
  const CSS = `
    #_sm_overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif}
    #_sm_box{background:#13161e;color:#e2e8f0;border-radius:14px;width:560px;max-width:96vw;padding:26px 28px;box-shadow:0 24px 80px rgba(0,0,0,.7);border:1px solid #252a38;max-height:92vh;overflow-y:auto}
    #_sm_box h2{margin:0 0 4px;font-size:17px;font-weight:700;color:#60a5fa}
    #_sm_box .sub{margin:0 0 16px;font-size:12px;color:#4b5563}
    ._f{margin-bottom:12px}
    ._f label{display:block;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.7px;margin-bottom:5px}
    ._f input,._f select,._f textarea{width:100%;box-sizing:border-box;background:#0d0f16;border:1px solid #252a38;border-radius:7px;color:#e2e8f0;font-size:13px;padding:8px 11px;outline:none;font-family:inherit}
    ._f textarea{resize:vertical;min-height:60px;font-family:monospace}
    ._f input:focus,._f select:focus,._f textarea:focus{border-color:#60a5fa}
    ._f small{display:block;font-size:11px;color:#374151;margin-top:3px}
    ._row{display:flex;gap:10px}._row ._f{flex:1}
    .btn{border:none;border-radius:8px;padding:9px 13px;font-size:12px;font-weight:700;cursor:pointer}
    .btn-b{background:#2563eb;color:#fff}.btn-b:hover{background:#1d4ed8}
    .btn-g{background:#1a1e2a;color:#9ca3af;border:1px solid #252a38}
    #_sm_info{background:#0d0f16;border:1px solid #252a38;border-radius:8px;padding:10px 13px;font-size:12px;color:#34d399;margin-bottom:14px;line-height:1.8}
    #_sm_prog{margin-top:12px;display:none}
    #_sm_prog_wrap{background:#0d0f16;border-radius:999px;height:7px;overflow:hidden;border:1px solid #252a38}
    #_sm_prog_bar{height:100%;width:0%;background:#2563eb;border-radius:999px;transition:width .4s}
    #_sm_actions{display:flex;gap:10px;margin-top:16px}
    #_sm_run{flex:1;background:#2563eb;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer}
    #_sm_run:disabled{background:#1e3a5f;cursor:not-allowed}
    #_sm_log{margin-top:14px;background:#080a0f;border-radius:8px;padding:11px;max-height:220px;overflow-y:auto;font-size:11px;font-family:monospace;display:none;border:1px solid #1a1e2a;line-height:1.7}
    #_sm_log .ok{color:#34d399}#_sm_log .err{color:#f87171}#_sm_log .inf{color:#60a5fa}#_sm_log .warn{color:#fbbf24}
  `;
  if (!document.getElementById("_sm_css")) {
    const s = document.createElement("style"); s.id = "_sm_css"; s.textContent = CSS; document.head.appendChild(s);
  }
  document.getElementById("_sm_overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "_sm_overlay";
  overlay.innerHTML = `
    <div id="_sm_box">
      <h2>🎓 Suraksha Student Migrator</h2>
      <p class="sub">Scrape legacy student pages → create/link in Suraksha</p>
      <div id="_sm_info">🔑 Paste your institute API key (STUDENT_CREATE; + CLASS_READ to load the class list).</div>

      <div class="_row">
        <div class="_f" style="flex:1">
          <label>Institute API Key *</label>
          <input id="_sm_apikey" type="password" placeholder="paste API key" value="${API_KEY}">
        </div>
        <div class="_f" style="flex:0 0 auto;align-self:flex-end">
          <button id="_sm_loadclasses" class="btn btn-g" type="button">Load classes</button>
        </div>
      </div>

      <div class="_f">
        <label>Enroll into class (optional)</label>
        <select id="_sm_class"><option value="">— none (institute level only) —</option></select>
        <small>Pick a class to auto-enroll each student during creation. Load classes first, or leave as none.</small>
      </div>

      <div class="_row">
        <div class="_f"><label>Legacy class ID (winsonline) *</label><input id="_sm_oldclass" value="${DEFAULT_CLASS_ID_OLD}"></div>
        <div class="_f"><label>Institute (tenant) password</label><input id="_sm_pw" value="Pass@12345"></div>
      </div>

      <div class="_f">
        <label>Legacy student IDs * (comma / space / newline separated)</label>
        <textarea id="_sm_ids" placeholder="25646  25647  25648 ..."></textarea>
      </div>

      <div id="_sm_prog"><div id="_sm_prog_wrap"><div id="_sm_prog_bar"></div></div></div>
      <div id="_sm_log"></div>

      <div id="_sm_actions">
        <button id="_sm_cancel" class="btn btn-g">✕ Close</button>
        <button id="_sm_run">🚀 Migrate students</button>
      </div>
    </div>`;
  (document.body || document.documentElement).appendChild(overlay);
  console.log("%c🎓 Suraksha Student Migrator rendered — look top-center of the page.", "color:#34d399;font-weight:bold");

  const $id = (id) => document.getElementById(id);
  const logEl = $id("_sm_log");
  const barEl = $id("_sm_prog_bar");
  const addLog = (msg, type = "inf") => {
    logEl.style.display = "block";
    const d = document.createElement("div"); d.className = type;
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight;
  };

  $id("_sm_cancel").onclick = () => overlay.remove();

  // ── Load class list (optional, for the enroll dropdown) ──
  $id("_sm_loadclasses").onclick = async () => {
    if (!getApiKey()) { addLog("Enter the API key first.", "err"); return; }
    const sel = $id("_sm_class");
    sel.innerHTML = `<option value="">— loading… —</option>`;
    const r = await safeFetch(EP.classes, { headers: authHeaders(false) });
    if (!r.ok) {
      sel.innerHTML = `<option value="">— none (load failed) —</option>`;
      addLog(`Class load failed (HTTP ${r.status}): ${r.parseError || r.networkError || ""}`, "err");
      return;
    }
    const classes = Array.isArray(r.data) ? r.data : (r.data.data || []);
    sel.innerHTML = `<option value="">— none (institute level only) —</option>` +
      classes.map(c => `<option value="${c.id}">${c.name}${c.code ? " (" + c.code + ")" : ""}</option>`).join("");
    addLog(`Loaded ${classes.length} classes`, "ok");
  };

  // ── Run migration ──
  $id("_sm_run").onclick = async () => {
    if (!getApiKey()) { addLog("❌ API key is required.", "err"); return; }

    const classIdNew = $id("_sm_class").value.trim();
    const oldClassId = $id("_sm_oldclass").value.trim();
    const institutePassword = $id("_sm_pw").value.trim();
    const ids = $id("_sm_ids").value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

    if (!oldClassId) { addLog("❌ Legacy class ID is required.", "err"); return; }
    if (!ids.length) { addLog("❌ Paste at least one legacy student ID.", "err"); return; }

    $id("_sm_run").disabled = true; $id("_sm_run").textContent = "⏳ Scraping…";
    $id("_sm_prog").style.display = "block"; barEl.style.background = "#2563eb"; barEl.style.width = "5%";
    addLog(`Processing ${ids.length} student(s)…`, "inf");

    // ── Scrape ──
    const scraped = [];
    const results = { created: [], linked: [], failed: [] };

    for (let i = 0; i < ids.length; i++) {
      const sid = ids[i];
      try {
        const res = await fetch(`${BASE_URL}/${oldClassId}/${sid}`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        if (html.includes("login") && !html.includes("cls_student_detail_wrapper"))
          throw new Error("Redirected to login — session expired?");
        const data = parseStudentPage(html, sid);
        addLog(`📄 ${sid}: ${data.name} | ${data.mobile || "no phone"}`, "inf");
        scraped.push(data);
      } catch (err) {
        addLog(`❌ scrape ${sid}: ${err.message}`, "err");
        results.failed.push({ studentId: sid, reason: `scrape: ${err.message}` });
      }
      barEl.style.width = `${5 + Math.round((i + 1) / ids.length * 45)}%`;
      if (i < ids.length - 1) await randomDelay();
    }

    if (!scraped.length) {
      addLog("Nothing scraped — aborting.", "err");
      barEl.style.background = "#f87171";
      $id("_sm_run").disabled = false; $id("_sm_run").textContent = "🚀 Migrate students";
      return;
    }

    // ── Build Suraksha records ──
    const toRecord = (s) => ({
      firstName: s.firstName,
      lastName: s.lastName || undefined,
      phoneNumber: s.mobile || undefined,
      gender: s.gender,
      dateOfBirth: s.dob || undefined,
      userIdByInstitute: String(s.studentId),
      ...(institutePassword ? { institutePassword } : {}),
      ...(classIdNew ? { classId: classIdNew } : {}),
      extraData: {
        legacyStudentId: String(s.studentId),
        barcodeId: String(s.studentId),
        guardianName: s.guardianName || "",
        guardianPhone: s.guardianMobile || "",
        address: s.address || "",
        school: s.school || "",
        paymentType: s.paymentType,
        legacyClassId: String(oldClassId),
      },
    });

    // ── Send in batches ──
    $id("_sm_run").textContent = "⏳ Sending…";
    for (let i = 0; i < scraped.length; i += BATCH_SIZE) {
      const slice = scraped.slice(i, i + BATCH_SIZE);
      const students = slice.map(toRecord);
      addLog(`📤 Batch ${Math.floor(i / BATCH_SIZE) + 1} — ${slice.length} students…`, "inf");

      const r = await safeFetch(EP.students, { method: "POST", headers: authHeaders(), body: JSON.stringify({ students }) });

      if (!r.ok) {
        const reason = r.data?.message || r.parseError || r.networkError || `HTTP ${r.status}`;
        addLog(`❌ batch failed: ${reason}`, "err");
        slice.forEach(s => results.failed.push({ studentId: s.studentId, reason }));
      } else {
        const d = r.data;
        (d.results || []).forEach(rr => {
          const src = slice[rr.index];
          const row = { legacyId: src?.studentId, surakshaUserId: rr.userId, name: src?.name,
                        assignment: rr.assignmentCreated ? "new" : "updated", classEnroll: rr.classEnrollment };
          if (rr.action === "created") results.created.push(row); else results.linked.push(row);
        });
        (d.failures || []).forEach(f => {
          const src = slice[f.index];
          results.failed.push({ studentId: src?.studentId, name: src?.name, reason: f.reason });
        });
        addLog(`✅ ${d.successCount} ok / ❌ ${d.failedCount} failed`, "ok");
      }

      barEl.style.width = `${50 + Math.round((i + slice.length) / scraped.length * 50)}%`;
      if (i + BATCH_SIZE < scraped.length) await randomDelay();
    }

    // ── Summary ──
    barEl.style.width = "100%";
    addLog(`DONE — 🆕 ${results.created.length} created · 🔗 ${results.linked.length} linked · ❌ ${results.failed.length} failed`, "ok");
    console.log("%c─── Student migration summary ───", "font-weight:bold");
    if (results.created.length) console.table(results.created);
    if (results.linked.length)  console.table(results.linked);
    if (results.failed.length)  console.table(results.failed);

    // Download failures as CSV (legacy id → reason) so you can fix and re-run.
    if (results.failed.length) {
      try {
        const csv = ["legacyStudentId,name,reason", ...results.failed.map(f =>
          `${String(f.studentId ?? "").replace(/,/g, ";")},${String(f.name ?? "").replace(/,/g, ";")},${String(f.reason ?? "").replace(/[,\n]/g, " ")}`)].join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = `suraksha_students_failed.csv`;
        a.click(); URL.revokeObjectURL(a.href);
        addLog(`📥 Failures downloaded as CSV`, "warn");
      } catch (e) { addLog(`⚠ CSV failed: ${e.message}`, "warn"); }
    }

    $id("_sm_run").disabled = false; $id("_sm_run").textContent = "🚀 Migrate again";
  };

  console.log("%c🎓 Suraksha Student Migrator loaded", "color:#3b82f6;font-size:14px;font-weight:bold");
})().catch(err => {
  console.error("❌ Suraksha Student Migrator failed to start:", err);
  try { alert("Student Migrator failed to start — see console:\n\n" + (err && err.message ? err.message : err)); } catch (_) {}
});
