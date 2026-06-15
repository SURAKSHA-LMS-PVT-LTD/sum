/**
 * ============================================================
 *  SURAKSHA LMS — STUDENT MIGRATOR (winsonline.lk → Suraksha)
 *  Paste into the browser DevTools console while logged in to winsonline.lk.
 *
 *  Scrapes student detail pages from the legacy system and registers them
 *  into Suraksha LMS via the institute API-key endpoint:
 *      POST /api/external/v1/students/bulk   (scope: STUDENT_CREATE)
 *
 *  Auth: institute API key (Bearer). The institute is derived from the key,
 *  so no orgId / instituteId is sent in the body.
 *
 *  NOTE: `password` here = INSTITUTE (tenant) login password → maps to
 *        `institutePassword` (stored as institute_password, NOT the global
 *        Suraksha user.password).
 * ============================================================
 */
(async () => {
  "use strict";

  // ─── CONFIG — EDIT THESE ─────────────────────────────────────
  const SURAKSHA_API   = "https://apilms.suraksha.lk";          // Suraksha backend base
  const API_KEY        = "PASTE_YOUR_INSTITUTE_API_KEY_HERE";    // key with STUDENT_CREATE scope
  const CLASS_ID_NEW   = "085e6528-db3b-489a-80b8-97133d6aa7cf"; // Suraksha class UUID — auto-enrolls into this class during creation. Set "" to skip class enrollment.
  const DEFAULT_INSTITUTE_PASSWORD = "Pass@12345";               // institute (tenant) login password for migrated students

  // Legacy (winsonline.lk) scrape config
  const CLASS_ID_OLD = 353;
  const BASE_URL     = "https://winsonline.lk/wins/index.php/classes/CLS_Students_C/show_cls_student_details";

  // Send students to Suraksha in batches (the bulk endpoint accepts many at once).
  const BATCH_SIZE   = 25;
  const DELAY_MIN_MS = 1500;
  const DELAY_MAX_MS = 4000;
  // ─────────────────────────────────────────────────────────────

  const STUDENTS_ENDPOINT = `${SURAKSHA_API}/api/external/v1/students/bulk`;

  const randomDelay = () => {
    const ms = Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS;
    console.log(`   ⏳ Waiting ${(ms / 1000).toFixed(1)}s...`);
    return new Promise(r => setTimeout(r, ms));
  };

  if (API_KEY.startsWith("PASTE_")) {
    const msg = "❌ Edit the API_KEY constant at the top of this script (institute key with STUDENT_CREATE scope) before pasting it again.";
    console.error(msg);
    try { alert(msg); } catch (_) {}
    return;
  }

  // ─── STEP 1 : ASK FOR LEGACY STUDENT IDS ─────────────────────
  const input = prompt("Enter legacy student IDs (comma / space / newline separated):", "");
  if (!input) { console.warn("No input. Aborting."); return; }

  const studentIds = input.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  if (!studentIds.length) { console.warn("No valid IDs parsed."); return; }

  console.log(`%c Processing ${studentIds.length} student(s)...`, "color:#378ADD;font-weight:bold");

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

    // Split full name → firstName + lastName for Suraksha
    const parts = name.split(" ").filter(Boolean);
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] || `Student${studentId}`);
    const lastName  = parts.length > 1 ? parts[parts.length - 1] : "";

    return {
      studentId, name, firstName, lastName, gender,
      dob: dob || null, school, address,
      mobile: studentMobile, guardianMobile, guardianName, paymentType,
    };
  };

  // ─── STEP 2 : SCRAPE EACH LEGACY STUDENT ─────────────────────
  const scraped = [];
  const scrapeFailed = [];

  for (let i = 0; i < studentIds.length; i++) {
    const sid = studentIds[i];
    console.log(`%c[${i + 1}/${studentIds.length}] Scraping ${sid}`, "color:#378ADD;font-weight:bold");
    try {
      const res = await fetch(`${BASE_URL}/${CLASS_ID_OLD}/${sid}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (html.includes("login") && !html.includes("cls_student_detail_wrapper"))
        throw new Error("Redirected to login — session expired?");
      const data = parseStudentPage(html, sid);
      console.log("   📄", data.name, "|", data.mobile);
      scraped.push(data);
    } catch (err) {
      console.error(`   ❌ scrape failed: ${err.message}`);
      scrapeFailed.push({ studentId: sid, reason: err.message });
    }
    if (i < studentIds.length - 1) await randomDelay();
  }

  if (!scraped.length) { console.warn("Nothing scraped. Aborting."); return; }

  // ─── STEP 3 : BUILD SURAKSHA RECORDS ─────────────────────────
  // Map legacy fields → ExternalStudentRecordDto.
  //   - institutePassword = tenant login password (NOT global user.password)
  //   - extraData holds everything else the legacy system had.
  const toRecord = (s) => ({
    firstName: s.firstName,
    lastName: s.lastName || undefined,
    phoneNumber: s.mobile || undefined,
    gender: s.gender,
    dateOfBirth: s.dob || undefined,
    userIdByInstitute: String(s.studentId),
    institutePassword: DEFAULT_INSTITUTE_PASSWORD,
    // Optional: enroll into this class during creation. Set CLASS_ID_NEW to "" to
    // assign at institute level only (no class enrollment).
    ...(CLASS_ID_NEW ? { classId: CLASS_ID_NEW } : {}),
    extraData: {
      legacyStudentId: String(s.studentId),
      barcodeId: String(s.studentId),
      guardianName: s.guardianName || "",
      guardianPhone: s.guardianMobile || "",
      address: s.address || "",
      school: s.school || "",
      paymentType: s.paymentType,
      legacyClassId: String(CLASS_ID_OLD),
    },
  });

  // ─── STEP 4 : SEND TO SURAKSHA IN BATCHES ────────────────────
  const results = { created: [], linked: [], failed: [...scrapeFailed] };

  for (let i = 0; i < scraped.length; i += BATCH_SIZE) {
    const slice = scraped.slice(i, i + BATCH_SIZE);
    const students = slice.map(toRecord);
    console.log(`%c📤 Sending batch ${Math.floor(i / BATCH_SIZE) + 1} (${slice.length} students)...`, "color:#378ADD");

    try {
      const apiRes = await fetch(STUDENTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
        body: JSON.stringify({ students }),
      });
      const data = await apiRes.json().catch(() => ({}));

      if (!apiRes.ok) {
        console.warn(`%c   ❌ batch failed: HTTP ${apiRes.status} ${data.message || ""}`, "color:#D85A30");
        slice.forEach((s, idx) => results.failed.push({ studentId: s.studentId, reason: data.message || `HTTP ${apiRes.status}` }));
        continue;
      }

      (data.results || []).forEach(r => {
        const src = slice[r.index];
        const row = {
          legacyId: src?.studentId, surakshaUserId: r.userId, name: src?.name,
          assignment: r.assignmentCreated ? "new" : "updated",
          classEnroll: r.classEnrollment, // 'created' | 'existing' | 'none'
        };
        if (r.action === "created") results.created.push(row); else results.linked.push(row);
      });
      (data.failures || []).forEach(f => {
        const src = slice[f.index];
        results.failed.push({ studentId: src?.studentId, name: src?.name, reason: f.reason });
      });

      console.log(`%c   ✅ ${data.successCount} ok / ❌ ${data.failedCount} failed`, "color:#1D9E75");
    } catch (err) {
      console.error(`   ❌ network error: ${err.message}`);
      slice.forEach(s => results.failed.push({ studentId: s.studentId, reason: err.message }));
    }

    if (i + BATCH_SIZE < scraped.length) await randomDelay();
  }

  // ─── STEP 5 : SUMMARY ────────────────────────────────────────
  console.log("%c\n─── DONE ───────────────────────────────────", "font-weight:bold");
  console.log(`%c 🆕 ${results.created.length} created  🔗 ${results.linked.length} linked  ❌ ${results.failed.length} failed`, "font-size:14px");
  if (results.created.length) console.table(results.created);
  if (results.linked.length)  console.table(results.linked);
  if (results.failed.length)  console.table(results.failed);

  return results;
})();
