/**
 * printRegistrationForm.ts
 * Per-field customisable printable student registration form.
 * No external library — uses the browser's native print dialog.
 */

/** Fine-grained toggle for every field / block on the printed form */
export interface PrintFormFields {
  // Extras
  photoBox: boolean;
  accountCredentials: boolean;

  // Reference numbers
  admissionNo: boolean;
  dateOfRegistration: boolean;
  instituteUserId: boolean;
  instituteCardId: boolean;

  // Personal info
  firstName: boolean;
  nameWithInitials: boolean;
  dateOfBirth: boolean;
  gender: boolean;
  nic: boolean;

  // Contact
  phoneNumber: boolean;
  emailAddress: boolean;

  // Address
  addressLine1: boolean;
  addressLine2: boolean;
  city: boolean;
  district: boolean;
  province: boolean;
  postalCode: boolean;

  // Health / Academic
  studentId: boolean;
  emergencyContact: boolean;
  bloodGroup: boolean;
  medicalConditions: boolean;
  allergies: boolean;

  // Father
  fatherSection: boolean;
  fatherNameWithInitials: boolean;
  fatherNic: boolean;
  fatherEmail: boolean;
  fatherDob: boolean;
  fatherGender: boolean;
  fatherOccupation: boolean;
  fatherWorkplace: boolean;
  fatherEducation: boolean;
  fatherAddress: boolean;

  // Mother
  motherSection: boolean;
  motherNameWithInitials: boolean;
  motherNic: boolean;
  motherEmail: boolean;
  motherDob: boolean;
  motherGender: boolean;
  motherOccupation: boolean;
  motherWorkplace: boolean;
  motherEducation: boolean;
  motherAddress: boolean;

  // Guardian
  guardianSection: boolean;
  guardianNameWithInitials: boolean;
  guardianNic: boolean;
  guardianEmail: boolean;
  guardianDob: boolean;
  guardianGender: boolean;
  guardianOccupation: boolean;
  guardianWorkplace: boolean;
  guardianEducation: boolean;
  guardianAddress: boolean;

  // Footer sections
  cardDelivery: boolean;
  signatures: boolean;
  officeUse: boolean;
  instructions: boolean;
}

export const DEFAULT_PRINT_FIELDS: PrintFormFields = {
  photoBox: true,
  accountCredentials: true,
  admissionNo: true,
  dateOfRegistration: true,
  instituteUserId: true,
  instituteCardId: true,
  firstName: true,
  nameWithInitials: true,
  dateOfBirth: true,
  gender: true,
  nic: true,
  phoneNumber: true,
  emailAddress: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  district: true,
  province: true,
  postalCode: true,
  studentId: true,
  emergencyContact: true,
  bloodGroup: true,
  medicalConditions: true,
  allergies: true,
  fatherSection: true,
  fatherNameWithInitials: true,
  fatherNic: true,
  fatherEmail: true,
  fatherDob: true,
  fatherGender: true,
  fatherOccupation: true,
  fatherWorkplace: true,
  fatherEducation: true,
  fatherAddress: true,
  motherSection: true,
  motherNameWithInitials: true,
  motherNic: true,
  motherEmail: true,
  motherDob: true,
  motherGender: true,
  motherOccupation: true,
  motherWorkplace: true,
  motherEducation: true,
  motherAddress: true,
  guardianSection: false,
  guardianNameWithInitials: true,
  guardianNic: true,
  guardianEmail: true,
  guardianDob: true,
  guardianGender: true,
  guardianOccupation: true,
  guardianWorkplace: true,
  guardianEducation: true,
  guardianAddress: true,
  cardDelivery: true,
  signatures: true,
  officeUse: true,
  instructions: true,
};

export interface PrintRegistrationOptions {
  instituteName?: string;
  instituteLogoUrl?: string;
  appLogoUrl?: string;
  copies?: number;
  fields?: Partial<PrintFormFields>;
}

export function printStudentRegistrationForm(options: PrintRegistrationOptions = {}) {
  const {
    instituteName = '',
    instituteLogoUrl = '',
    appLogoUrl = '',
    copies = 1,
    fields: fieldOverrides = {},
  } = options;

  const f: PrintFormFields = { ...DEFAULT_PRINT_FIELDS, ...fieldOverrides };

  const formHtml = buildFormHtml(instituteName, instituteLogoUrl, appLogoUrl, f);
  const formsHtml = Array.from({ length: copies }, () => formHtml).join(
    '<div style="page-break-after: always;"></div>',
  );

  const win = window.open('', '_blank', 'width=960,height=960');
  if (!win) {
    alert('Please allow pop-ups to generate the registration form.');
    return;
  }

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Student Registration Form</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 10mm; }
    html { font-size: 10.5pt; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #111; background: #f3f4f6; padding: 16mm 10mm;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    @media print {
      body { padding: 0; margin: 0; background: #fff; }
      .no-print { display: none !important; }
      .page-break { page-break-after: always; }
    }
    .print-btn-bar {
      position: sticky; top: 0; left: 0; right: 0;
      display: flex; flex-wrap: wrap; gap: 8px; z-index: 9999;
      padding: 10px 16px; background: #fff;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
      justify-content: center;
    }
    .print-btn, .close-btn, .back-btn {
      padding: 10px 20px; border: none; border-radius: 8px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      min-height: 44px; min-width: 44px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .print-btn { background: #2563eb; color: #fff; flex: 1; max-width: 200px; }
    .print-btn:hover, .print-btn:active { background: #1d4ed8; }
    .back-btn { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; flex: 1; max-width: 200px; }
    .back-btn:hover, .back-btn:active { background: #e5e7eb; }
    .close-btn { background: #6b7280; color: #fff; flex: 1; max-width: 200px; }
    .close-btn:hover, .close-btn:active { background: #4b5563; }
    .form-page {
      width: 210mm; max-width: 100%; margin: 20px auto 28px auto;
      background: #fff; border: 1px solid #d1d5db;
      border-radius: 6px; padding: 10mm 12mm 14mm 12mm;
      box-shadow: 0 2px 10px rgba(0,0,0,0.07);
    }
    @media screen and (max-width: 800px) {
      body { padding: 0; }
      .form-page { border-radius: 0; border-left: none; border-right: none; padding: 6mm 5mm 10mm 5mm; width: 100%; }
      .print-btn-bar { padding: 8px 12px; }
      .print-btn, .close-btn, .back-btn { padding: 12px 14px; font-size: 13px; }
    }
    .form-header {
      display: flex; align-items: center; gap: 12px;
      border-bottom: 2.5px solid #2563eb;
      padding-bottom: 10px; margin-bottom: 14px;
    }
    .header-logo { width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; border-radius: 6px; }
    .header-logo-placeholder {
      width: 52px; height: 52px; flex-shrink: 0;
      background: #eff6ff; border: 1.5px dashed #93c5fd; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 7pt; color: #93c5fd; text-align: center;
    }
    .header-text { flex: 1; text-align: center; }
    .institute-name {
      font-size: 15pt; font-weight: 700; color: #1e40af; letter-spacing: 0.3px;
      min-height: 20pt; border-bottom: 1px solid #bfdbfe;
      padding-bottom: 2px; margin-bottom: 4px;
    }
    .form-title { font-size: 12pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .form-subtitle { font-size: 8pt; color: #555; margin-top: 3px; }
    .photo-box {
      float: right; width: 30mm; height: 37mm;
      border: 1.5px solid #888; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-size: 7.5pt; color: #888; text-align: center;
      margin: 0 0 10px 14px; padding: 5px; line-height: 1.4; border-radius: 3px;
    }
    .section-title {
      font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      background: #eff6ff; border-left: 3px solid #2563eb;
      padding: 4px 8px; margin: 13px 0 8px 0; color: #1e40af; clear: both;
    }
    .field-grid { display: grid; gap: 8px 14px; }
    .col-1 { grid-template-columns: 1fr; }
    .col-2 { grid-template-columns: 1fr 1fr; }
    .col-3 { grid-template-columns: 1fr 1fr 1fr; }
    .col-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .field-label { font-size: 6.8pt; font-weight: 600; text-transform: uppercase; color: #555; letter-spacing: 0.3px; }
    .field-required { color: #dc2626; margin-left: 1px; }
    .field-line { border: none; border-bottom: 1px solid #aaa; height: 17px; width: 100%; background: transparent; }
    .field-line-tall { border: 1px solid #aaa; height: 36px; width: 100%; background: transparent; border-radius: 2px; }
    .checkbox-row { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 3px; }
    .checkbox-item { display: flex; align-items: center; gap: 4px; font-size: 9pt; }
    .checkbox-item input[type=checkbox] { width: 12px; height: 12px; accent-color: #2563eb; }
    .signature-area { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .sig-box { border-top: 1px solid #888; padding-top: 4px; font-size: 7.5pt; color: #555; text-align: center; }
    .instructions-box { border: 1px dashed #aaa; border-radius: 4px; padding: 8px 11px; margin-top: 13px; font-size: 7.5pt; color: #444; line-height: 1.6; }
    ol.instr-list { margin: 4px 0 0 14px; padding: 0; }
    ol.instr-list li { margin-bottom: 2px; }
    .office-use { margin-top: 13px; border: 1px solid #e5e7eb; border-radius: 4px; padding: 7px 10px; background: #f9fafb; }
    .office-use-title { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #999; margin-bottom: 7px; letter-spacing: 0.5px; }
    .form-footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: flex-end; gap: 8px; opacity: 0.55; }
    .footer-logo { height: 18px; object-fit: contain; }
    .footer-brand { font-size: 8pt; font-weight: 600; color: #6b7280; }
    .footer-text { font-size: 7pt; color: #9ca3af; }
    .clearfix::after { content: ''; display: table; clear: both; }
    .mt8 { margin-top: 8px; }
  </style>
</head>
<body>
  <div class="print-btn-bar no-print">
    <button class="back-btn" onclick="window.history.length>1?window.history.back():window.close()">&#8592; Back</button>
    <button class="print-btn" onclick="window.print()">&#128424;&#65039; Print / Save as PDF</button>
    <button class="close-btn" onclick="window.close()">&#10005; Close</button>
  </div>
  ${formsHtml}
</body>
</html>`);

  win.document.close();
  win.addEventListener('load', () => win.print());
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function field(label: string, required = false, wide = false): string {
  return `
    <div class="field">
      <span class="field-label">${label}${required ? '<span class="field-required">*</span>' : ''}</span>
      <div class="${wide ? 'field-line-tall' : 'field-line'}"></div>
    </div>`;
}

function genderCheckboxes(required = false): string {
  return `
    <div class="field">
      <span class="field-label">Gender${required ? '<span class="field-required">*</span>' : ''}</span>
      <div class="checkbox-row" style="margin-top:4px;">
        <label class="checkbox-item"><input type="checkbox"> Male</label>
        <label class="checkbox-item"><input type="checkbox"> Female</label>
        <label class="checkbox-item"><input type="checkbox"> Other</label>
      </div>
    </div>`;
}

function bloodGroupCheckboxes(): string {
  const groups = ['A+', 'A−', 'B+', 'B−', 'O+', 'O−', 'AB+', 'AB−'];
  return `
    <div class="field">
      <span class="field-label">Blood Group</span>
      <div class="checkbox-row" style="margin-top:4px;">
        ${groups.map(g => `<label class="checkbox-item"><input type="checkbox"> ${g}</label>`).join('')}
      </div>
    </div>`;
}

/** Renders a grid row; omits cells that are false/null/undefined; returns '' if all empty */
function gridRow(cells: (string | false | null | undefined)[], extraClass = ''): string {
  const visible = cells.filter((c): c is string => typeof c === 'string' && c.length > 0);
  if (visible.length === 0) return '';
  return `<div class="field-grid col-${visible.length} ${extraClass}">${visible.join('')}</div>`;
}

interface ParentFieldFlags {
  nameWithInitials: boolean;
  nic: boolean;
  email: boolean;
  dob: boolean;
  gender: boolean;
  occupation: boolean;
  workplace: boolean;
  education: boolean;
  address: boolean;
}

function parentSection(role: 'Father' | 'Mother' | 'Guardian', pf: ParentFieldFlags): string {
  const rows: string[] = [];

  // First + Last name always shown inside a parent section
  rows.push(gridRow([field('First Name'), field('Last Name')]));

  const r2 = gridRow([
    pf.nameWithInitials && field('Name with Initials (e.g. K.M. Silva)'),
    pf.nic && field('NIC / Passport No.'),
  ], 'mt8');
  if (r2) rows.push(r2);

  // Phone always shown; email optional
  rows.push(gridRow([field('Phone Number'), pf.email && field('Email Address')], 'mt8'));

  const r4 = gridRow([
    pf.dob && field('Date of Birth (YYYY-MM-DD)'),
    pf.gender && genderCheckboxes(),
    pf.occupation && field('Occupation'),
  ], 'mt8');
  if (r4) rows.push(r4);

  const r5 = gridRow([
    pf.workplace && field('Workplace / Employer'),
    pf.education && field('Education Level'),
  ], 'mt8');
  if (r5) rows.push(r5);

  if (pf.address) {
    rows.push(`<div class="field-grid col-1 mt8">${field('Address Line 1')}</div>`);
    rows.push(`<div class="field-grid col-3 mt8">${field('City')}${field('District')}${field('Province')}</div>`);
  }

  return `<div class="section-title">${role}'s Information</div>${rows.join('')}`;
}

function escHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeSrc(url: string): string {
  // Only allow https, http, and data URIs — block javascript: and other schemes
  return /^(https?:|data:image\/)/i.test(url.trim()) ? url : '';
}

function buildFormHtml(
  instituteName: string,
  instituteLogoUrl: string,
  appLogoUrl: string,
  f: PrintFormFields,
): string {
  const safeLogoUrl = safeSrc(instituteLogoUrl);
  const logoHtml = safeLogoUrl
    ? `<img class="header-logo" src="${safeLogoUrl}" alt="Institute Logo" />`
    : `<div class="header-logo-placeholder"><span>Logo</span></div>`;

  const logoImgSrc = safeSrc(appLogoUrl) || 'https://storage.suraksha.lk/public/suraksha-logo.png';
  const footerHtml = `<img class="footer-logo" src="${logoImgSrc}" alt="Suraksha LMS" onerror="this.style.display='none'" /><span class="footer-brand">Suraksha LMS</span>`;

  // ── Reference numbers ────────────────────────────────────────────────────
  const showRef = f.admissionNo || f.dateOfRegistration || f.instituteUserId || f.instituteCardId;
  const refHtml = showRef ? [
    gridRow([f.admissionNo && field('Registration / Admission No.'), f.dateOfRegistration && field('Date of Registration (YYYY-MM-DD)')]),
    gridRow([f.instituteUserId && field('Institute User ID'), f.instituteCardId && field('Institute Card ID')], 'mt8'),
  ].join('') : '';

  // ── Personal info ────────────────────────────────────────────────────────
  const showPersonal = f.firstName || f.nameWithInitials || f.dateOfBirth || f.gender || f.nic;
  const personalHtml = showPersonal ? `
    <div class="section-title">Student Personal Information</div>
    ${f.firstName ? gridRow([field('First Name', true), field('Last Name', true)]) : ''}
    ${f.nameWithInitials ? `<div class="field-grid col-1 mt8">${field('Full Name with Initials (e.g. K.M.A. Perera)', true)}</div>` : ''}
    ${gridRow([f.dateOfBirth && field('Date of Birth (YYYY-MM-DD)', true), f.gender && genderCheckboxes(true), f.nic && field('NIC / Birth Certificate No.')], 'mt8')}
  ` : '';

  // ── Contact ──────────────────────────────────────────────────────────────
  const showContact = f.phoneNumber || f.emailAddress;
  const contactHtml = showContact ? `
    <div class="section-title">Contact Details</div>
    ${gridRow([f.phoneNumber && field('Phone Number', true), f.emailAddress && field('Email Address')])}
  ` : '';

  // ── Address ───────────────────────────────────────────────────────────────
  const showAddress = f.addressLine1 || f.addressLine2 || f.city || f.district || f.province || f.postalCode;
  const addressHtml = showAddress ? `
    <div class="section-title">Residential Address</div>
    ${f.addressLine1 ? `<div class="field-grid col-1">${field('Address Line 1', true)}</div>` : ''}
    ${f.addressLine2 ? `<div class="field-grid col-1 mt8">${field('Address Line 2')}</div>` : ''}
    ${gridRow([f.city && field('City', true), f.district && field('District'), f.province && field('Province'), f.postalCode && field('Postal Code')], 'mt8')}
  ` : '';

  // ── Health ────────────────────────────────────────────────────────────────
  const showHealth = f.studentId || f.emergencyContact || f.bloodGroup || f.medicalConditions || f.allergies;
  const healthHtml = showHealth ? `
    <div class="section-title">Academic &amp; Health Information</div>
    ${gridRow([f.studentId && field('Student ID (if already assigned)'), f.emergencyContact && field('Emergency Contact Number')])}
    ${f.bloodGroup ? `<div class="field-grid col-1 mt8">${bloodGroupCheckboxes()}</div>` : ''}
    ${gridRow([f.medicalConditions && field('Medical Conditions (if any)', false, true), f.allergies && field('Allergies (if any)', false, true)], 'mt8')}
  ` : '';

  // ── Credentials ───────────────────────────────────────────────────────────
  const accountHtml = f.accountCredentials ? `
    <div class="section-title">Account Access (to be set by student)</div>
    <div class="field-grid col-2">${field('Preferred Password', true)}${field('Confirm Password', true)}</div>
    <div style="font-size:7pt;color:#888;margin-top:3px;">Password must be at least 8 characters. Do not share with anyone.</div>
  ` : '';

  // ── Parents ───────────────────────────────────────────────────────────────
  const fatherHtml = f.fatherSection ? parentSection('Father', {
    nameWithInitials: f.fatherNameWithInitials, nic: f.fatherNic, email: f.fatherEmail,
    dob: f.fatherDob, gender: f.fatherGender, occupation: f.fatherOccupation,
    workplace: f.fatherWorkplace, education: f.fatherEducation, address: f.fatherAddress,
  }) : '';

  const motherHtml = f.motherSection ? parentSection('Mother', {
    nameWithInitials: f.motherNameWithInitials, nic: f.motherNic, email: f.motherEmail,
    dob: f.motherDob, gender: f.motherGender, occupation: f.motherOccupation,
    workplace: f.motherWorkplace, education: f.motherEducation, address: f.motherAddress,
  }) : '';

  const guardianHtml = f.guardianSection ? parentSection('Guardian', {
    nameWithInitials: f.guardianNameWithInitials, nic: f.guardianNic, email: f.guardianEmail,
    dob: f.guardianDob, gender: f.guardianGender, occupation: f.guardianOccupation,
    workplace: f.guardianWorkplace, education: f.guardianEducation, address: f.guardianAddress,
  }) : '';

  // ── Footer sections ───────────────────────────────────────────────────────
  const cardDeliveryHtml = f.cardDelivery ? `
    <div class="section-title">ID Card Delivery Recipient</div>
    <div class="checkbox-row" style="margin-bottom:4px;">
      <label class="checkbox-item"><input type="checkbox"> Self (Student)</label>
      <label class="checkbox-item"><input type="checkbox"> Father</label>
      <label class="checkbox-item"><input type="checkbox"> Mother</label>
      <label class="checkbox-item"><input type="checkbox"> Guardian</label>
    </div>` : '';

  const signaturesHtml = f.signatures ? `
    <div class="signature-area">
      <div class="sig-box">Student Signature &amp; Date</div>
      <div class="sig-box">Parent / Guardian Signature &amp; Date</div>
      <div class="sig-box">Authorized by (Office Use)</div>
    </div>` : '';

  const officeUseHtml = f.officeUse ? `
    <div class="office-use">
      <div class="office-use-title">For Office Use Only</div>
      <div class="field-grid col-4">
        ${field('Received by')}${field('Date Received')}${field('Data Entered by')}${field('Verified by')}
      </div>
    </div>` : '';

  const instructionsHtml = f.instructions ? `
    <div class="instructions-box">
      <strong>Instructions for Completion &amp; Submission:</strong>
      <ol class="instr-list">
        <li>Fill all required (<span style="color:#dc2626;">*</span>) fields clearly in <strong>BLOCK CAPITALS</strong> using a black or dark-blue pen.</li>
        ${f.photoBox ? '<li>Attach a recent passport-size photograph (not older than 6 months) in the box provided.</li>' : ''}
        <li>Submit the completed form along with a copy of your NIC / Birth Certificate to the institute office.</li>
        <li>Keep a copy of this form for your records before submission.</li>
        <li>Your data will be used to create your online account. Login credentials will be sent via SMS/email.</li>
        <li>For assistance, contact the institute office.</li>
      </ol>
    </div>` : '';

  return `
  <div class="form-page">
    <div class="form-header">
      ${logoHtml}
      <div class="header-text">
        <div class="institute-name">${escHtml(instituteName) || '&nbsp;'}</div>
        <div class="form-title">Student Registration Form</div>
        <div class="form-subtitle">Please complete all required (<span style="color:#dc2626;">*</span>) fields clearly in BLOCK CAPITALS using a black pen</div>
      </div>
    </div>

    <div class="clearfix">
      ${f.photoBox ? `<div class="photo-box"><span>Passport-size<br>Photograph<br>(Recent)</span><span style="margin-top:6px;font-size:6.5pt;">Do not fold or<br>staple photo</span></div>` : ''}
      ${refHtml}
    </div>

    ${personalHtml}
    ${contactHtml}
    ${addressHtml}
    ${healthHtml}
    ${accountHtml}
    ${fatherHtml}
    ${motherHtml}
    ${guardianHtml}
    ${cardDeliveryHtml}
    ${signaturesHtml}
    ${officeUseHtml}
    ${instructionsHtml}

    <div class="form-footer">
      <span class="footer-text">Powered by</span>
      ${footerHtml}
    </div>
  </div>`;
}
