// ═══════════════════════════════════════════════════════════════════════════
// ReportDialog.tsx  —  Shared report configuration dialog
//
// USAGE:
//   import ReportDialog from '@/components/ReportDialog';
//
//   <ReportDialog
//     open={showReportDialog}
//     onClose={() => setShowReportDialog(false)}
//     onGenerate={(opts, printOpts) => handleGenerateReport(opts, printOpts)}
//     generating={generatingReport}
//     progress={{ current: 0, total: 0 }}   // omit for single-student
//     title="Generate Report"
//   />
//
// DESIGNER TODO:
//   [ ] Replace <dialog> wrapper with your Modal/Sheet/Drawer component
//   [ ] Style section checkboxes with your Checkbox component
//   [ ] Style date inputs with your DatePicker component
//   [ ] Style advanced settings with a collapsible Accordion/Disclosure
//   [ ] Add a progress ring or bar for batch generation (progress prop)
//   [ ] Add student count badge to the title when generating batch
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import type { ClassReportOptions, PrintOptions, StudentFieldOptions } from '@/utils/studentClassReport';

// ─── Date range helpers ───────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];
const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportDateRanges {
  attendanceStart: string;
  attendanceEnd: string;
  paymentsStart: string;
  paymentsEnd: string;
  liveStart: string;
  liveEnd: string;
  recordingStart: string;
  recordingEnd: string;
}

export interface ReportDialogResult {
  options: ClassReportOptions;
  dateRanges: ReportDateRanges;
  printOptions: PrintOptions;
}

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called when user clicks Generate.  Caller is responsible for actually generating. */
  onGenerate: (result: ReportDialogResult) => void;
  /** Show spinner / progress state on the Generate button */
  generating?: boolean;
  /** Optional batch progress — shown as "3 / 10" below the button */
  progress?: { current: number; total: number };
  title?: string;
  /** Pre-populate section toggles (defaults all true) */
  defaultOptions?: Partial<ClassReportOptions>;
  /** When false, date range inputs are hidden (single-student mode uses profile page dates) */
  showDateRanges?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ReportDialog: React.FC<ReportDialogProps> = ({
  open,
  onClose,
  onGenerate,
  generating = false,
  progress,
  title = 'Generate Report',
  defaultOptions = {},
  showDateRanges = true,
}) => {
  // ── Section toggles ─────────────────────────────────────────────────────
  const [sections, setSections] = useState<ClassReportOptions>({
    physical: defaultOptions.physical ?? true,
    live: defaultOptions.live ?? true,
    recording: defaultOptions.recording ?? true,
    payments: defaultOptions.payments ?? true,
    paymentMode: defaultOptions.paymentMode ?? 'SUMMARY',
    physicalTotalMode: defaultOptions.physicalTotalMode ?? 'AUTO',
    physicalTotalValue: defaultOptions.physicalTotalValue ?? 0,
  });

  // ── Date ranges ──────────────────────────────────────────────────────────
  const [ranges, setRanges] = useState<ReportDateRanges>({
    attendanceStart: monthsAgo(3),
    attendanceEnd: today(),
    paymentsStart: monthsAgo(12),
    paymentsEnd: today(),
    liveStart: monthsAgo(3),
    liveEnd: today(),
    recordingStart: monthsAgo(3),
    recordingEnd: today(),
  });

  // ── Student detail fields ─────────────────────────────────────────────────
  // Which details to include in the student cover block of each PDF.
  const [studentFields, setStudentFields] = useState<StudentFieldOptions>({
    showImage: true,
    useFallbackGlobalImage: true,
    showNameWithInitials: true,
    showFullName: true,
    showDateOfBirth: true,
    showInstituteUserId: true,
    showSurakshaUserId: true,
    showAddress: true,
  });

  // ── Advanced / print options ─────────────────────────────────────────────
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [evenPages, setEvenPages] = useState(false);
  const [bindingMarginMm, setBindingMarginMm] = useState(0);
  const [pageNumberOffset, setPageNumberOffset] = useState(0);
  const [topMarginMm, setTopMarginMm] = useState(0);
  const [headerPosition, setHeaderPosition] = useState<'top'|'left'>('top');

  if (!open) return null;

  const handleGenerate = () => {
    onGenerate({
      options: sections,
      dateRanges: ranges,
      printOptions: {
        evenPages,
        bindingMarginMm,
        pageNumberOffset,
        topMarginMm,
        headerPosition,
        studentFields,
      },
    });
  };

  const anySectionEnabled = Object.values(sections).some(Boolean);

  return (
    // TODO designer: replace this backdrop+card with your Modal component
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(15, 23, 42, 0.28)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{title}</h2>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>Select what to show, then tune the print layout.</p>

        {/* ── Section toggles ─────────────────────────────────────────────── */}
        {/* TODO designer: style with your Checkbox component */}
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
          <legend style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Sections to include</legend>
          {([
            { key: 'physical' as const, label: 'Physical / General Attendance' },
            { key: 'live' as const, label: 'Live Lecture Attendance' },
            { key: 'recording' as const, label: 'Recording Attendance' },
            { key: 'payments' as const, label: 'Payments' },
          ]).map(({ key, label }) => (
            <div key={key}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={sections[key] === true}
                  onChange={e => setSections(p => ({ ...p, [key]: e.target.checked }))}
                  style={{ width: 14, height: 14 }}
                />
                {label}
              </label>
              
              {/* Physical Attendance Mode Sub-option */}
              {key === 'physical' && sections.physical && (
                <div style={{ marginLeft: 22, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Total Attendance Logic:</span>
                  <select 
                    value={sections.physicalTotalMode} 
                    onChange={e => setSections(p => ({ ...p, physicalTotalMode: e.target.value as any }))}
                    style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white' }}
                  >
                    <option value="AUTO">Auto (List Count)</option>
                    <option value="GROUP">Group Wise</option>
                    <option value="SESSION">Session Wise</option>
                    <option value="DAY">Day Wise</option>
                    <option value="CUSTOM">Custom Total</option>
                  </select>
                  {sections.physicalTotalMode === 'CUSTOM' && (
                    <input 
                      type="number" 
                      placeholder="Enter total" 
                      value={sections.physicalTotalValue || ''} 
                      onChange={e => setSections(p => ({ ...p, physicalTotalValue: Number(e.target.value) }))}
                      style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    />
                  )}
                </div>
              )}

              {/* Payment Mode Sub-option */}
              {key === 'payments' && sections.payments && (
                <div style={{ marginLeft: 22, marginBottom: 10, display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
                    <input
                      type="radio"
                      name="paymentMode"
                      checked={sections.paymentMode === 'SUMMARY'}
                      onChange={() => setSections(p => ({ ...p, paymentMode: 'SUMMARY' }))}
                      style={{ width: 12, height: 12 }}
                    />
                    Summary Only
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
                    <input
                      type="radio"
                      name="paymentMode"
                      checked={sections.paymentMode === 'FULL'}
                      onChange={() => setSections(p => ({ ...p, paymentMode: 'FULL' }))}
                      style={{ width: 12, height: 12 }}
                    />
                    Full Table
                  </label>
                </div>
              )}
            </div>
          ))}
        </fieldset>

        {/* ── Student detail fields ────────────────────────────────────────── */}
        {/* TODO designer: style with your Checkbox component + indent sub-option */}
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
          <legend style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Student details to show</legend>

          {/* Image toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={studentFields.showImage}
              onChange={e => setStudentFields(p => ({ ...p, showImage: e.target.checked }))}
              style={{ width: 14, height: 14 }}
            />
            Profile image
          </label>
          {/* Sub-option: only shown when image is enabled */}
          {studentFields.showImage && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, marginLeft: 22, cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
              <input
                type="checkbox"
                checked={studentFields.useFallbackGlobalImage}
                onChange={e => setStudentFields(p => ({ ...p, useFallbackGlobalImage: e.target.checked }))}
                style={{ width: 12, height: 12 }}
              />
              Use global Suraksha image if no institute-specific image
              <br />
              <span style={{ fontSize: 11, color: '#9ca3af' }}>(untick = empty circle when no institute image)</span>
            </label>
          )}

          {([
            { key: 'showNameWithInitials' as const, label: 'Name with initials' },
            { key: 'showFullName' as const, label: 'Full name' },
            { key: 'showDateOfBirth' as const, label: 'Date of birth' },
            { key: 'showInstituteUserId' as const, label: 'Institute user ID' },
            { key: 'showSurakshaUserId' as const, label: 'Suraksha system user ID' },
            { key: 'showAddress' as const, label: 'Address' },
          ]).map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={studentFields[key]}
                onChange={e => setStudentFields(p => ({ ...p, [key]: e.target.checked }))}
                style={{ width: 14, height: 14 }}
              />
              {label}
            </label>
          ))}
        </fieldset>

        {/* ── Per-section date ranges ─────────────────────────────────────── */}
        {/* TODO designer: style with your DatePicker / Input component */}
        {showDateRanges && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Date ranges</p>

            {sections.physical && (
              <DateRangeRow
                label="Attendance"
                start={ranges.attendanceStart} end={ranges.attendanceEnd}
                onStart={v => setRanges(p => ({ ...p, attendanceStart: v }))}
                onEnd={v => setRanges(p => ({ ...p, attendanceEnd: v }))}
              />
            )}
            {sections.live && (
              <DateRangeRow
                label="Live Classes"
                start={ranges.liveStart} end={ranges.liveEnd}
                onStart={v => setRanges(p => ({ ...p, liveStart: v }))}
                onEnd={v => setRanges(p => ({ ...p, liveEnd: v }))}
              />
            )}
            {sections.recording && (
              <DateRangeRow
                label="Recording"
                start={ranges.recordingStart} end={ranges.recordingEnd}
                onStart={v => setRanges(p => ({ ...p, recordingStart: v }))}
                onEnd={v => setRanges(p => ({ ...p, recordingEnd: v }))}
              />
            )}
            {sections.payments && (
              <DateRangeRow
                label="Payments (due date)"
                start={ranges.paymentsStart} end={ranges.paymentsEnd}
                onStart={v => setRanges(p => ({ ...p, paymentsStart: v }))}
                onEnd={v => setRanges(p => ({ ...p, paymentsEnd: v }))}
              />
            )}
          </div>
        )}

        {/* ── Advanced settings ────────────────────────────────────────────── */}
        {/* TODO designer: replace toggle with your Accordion/Disclosure component */}
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(p => !p)}
            style={{ fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8 }}
          >
            {showAdvanced ? '▲ Hide' : '▼ Show'} Advanced Print Settings
          </button>

          {showAdvanced && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/*
               * evenPages:
               *   When generating bulk PDFs (one per student), each student's PDF
               *   will be padded to an even number of pages with a blank last page.
               *   This means in a duplex (two-sided) printout, each new student
               *   always starts on a fresh right-hand page — no bleed-over.
               *   Useful when handing printed packets to individual students.
               */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={evenPages}
                  onChange={e => setEvenPages(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  <b>Even pages per student</b><br />
                  Pads each PDF to an even page count. Useful for duplex / booklet bulk printing so every student starts on a fresh right-hand side.
                </span>
              </label>

              {/* Margins Section */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                <p style={{ fontWeight: 600, fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Print Margins</p>
                
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Left Margin (Binding): {bindingMarginMm} mm
                  </label>
                  <input
                    type="range" min={0} max={30} step={1}
                    value={bindingMarginMm}
                    onChange={e => setBindingMarginMm(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Top Margin (Offset): {topMarginMm} mm
                  </label>
                  <input
                    type="range" min={0} max={30} step={1}
                    value={topMarginMm}
                    onChange={e => setTopMarginMm(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Header position
                  </label>
                  <select
                    value={headerPosition}
                    onChange={e => setHeaderPosition(e.target.value as 'top' | 'left')}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', background: 'white' }}
                  >
                    <option value="top">Top banner</option>
                    <option value="left">Left-aligned header</option>
                  </select>
                </div>
              </div>

              {/*
               * pageNumberOffset:
               *   When printing multiple students back-to-back as a single merged job,
               *   set this to the total pages of all previous students.
               *   E.g. student A = 3 pages → set offset to 3 for student B, so B shows 4, 5, 6.
               *   NOTE: the ReportDialog doesn't auto-increment between students.
               *   Batch generation in StudentReportsPage should accumulate page counts.
               *   TODO (nice-to-have): expose an "auto-offset" toggle in StudentReportsPage
               *   that tracks running total and passes the right offset to each student.
               */}
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Page number offset: {pageNumberOffset}
                </label>
                <input
                  type="number" min={0} max={9999}
                  value={pageNumberOffset}
                  onChange={e => setPageNumberOffset(Math.max(0, Number(e.target.value)))}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px', width: 80 }}
                />
                <span style={{ marginLeft: 6, color: '#94a3b8' }}>
                  {pageNumberOffset > 0 ? `Page 1 shows as page ${pageNumberOffset + 1}` : 'Normal page numbers'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Action buttons ───────────────────────────────────────────────── */}
        {/* TODO designer: use your Button component */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={generating}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !anySectionEnabled}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#4f46e5', color: 'white', cursor: 'pointer', fontSize: 13, opacity: (!anySectionEnabled || generating) ? 0.5 : 1 }}
          >
            {generating ? 'Generating…' : 'Generate PDF'}
          </button>
        </div>

        {/* Batch progress indicator */}
        {progress && progress.total > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ background: '#e2e8f0', borderRadius: 4, height: 4, overflow: 'hidden' }}>
              <div style={{ background: '#4f46e5', height: '100%', width: `${Math.round(progress.current / progress.total * 100)}%`, transition: 'width 0.3s' }} />
            </div>
            <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0', textAlign: 'center' }}>
              {progress.current} / {progress.total} students
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── DateRangeRow sub-component ───────────────────────────────────────────────
// TODO designer: replace with your DatePicker pair

const DateRangeRow: React.FC<{
  label: string;
  start: string; end: string;
  onStart: (v: string) => void; onEnd: (v: string) => void;
}> = ({ label, start, end, onStart, onEnd }) => (
  <div style={{ marginBottom: 8 }}>
    <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{label}</span>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="date" value={start} onChange={e => onStart(e.target.value)}
        style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px', fontSize: 12, flex: 1 }} />
      <span style={{ fontSize: 11, color: '#94a3b8' }}>to</span>
      <input type="date" value={end} onChange={e => onEnd(e.target.value)}
        style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px', fontSize: 12, flex: 1 }} />
    </div>
  </div>
);

export default ReportDialog;
