/**
 * PUBLIC REGISTRATION PAGE — /forms/:token
 *
 * Unauthenticated self-registration. All fields are shown immediately (same as admin
 * create-user form). Phone/email verification happens inline when the user types a
 * value — they can verify via WhatsApp QR (phone) or emailed code (email).
 * If the link config marks a contact as required, submit validates it is verified.
 * Existing-account detection fires on the first verified contact that matches.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { registrationLinksApi, PublicFormConfig } from '@/api/registrationLinks.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, CheckCircle2, AlertCircle, GraduationCap, UserPlus, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getImageUrl } from '@/utils/imageUrlHelper';
import WhatsAppPhoneVerify, { fmtMMSS } from '@/components/registration/WhatsAppPhoneVerify';
import ParentSection, { ParentData } from '@/components/registration/ParentSection';

type ContactState = {
  value: string;
  requested: boolean;
  verified: boolean;
  existingUserId?: string | null;
};

export default function PublicRegistrationPage() {
  const { token } = useParams<{ token: string }>();

  const [config, setConfig] = useState<PublicFormConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Inline contact verification
  const [phone, setPhone] = useState<ContactState>({ value: '', requested: false, verified: false });
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [email, setEmail] = useState<ContactState>({ value: '', requested: false, verified: false });
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailExpiresAt, setEmailExpiresAt] = useState<string | null>(null);
  const [emailRemaining, setEmailRemaining] = useState<number | null>(null);

  // Existing-account detection
  const [existing, setExisting] = useState<null | {
    existingUserId: string;
    filled: Record<string, any>;
    missing: string[];
    hasFather?: boolean;
    hasMother?: boolean;
    hasGuardian?: boolean;
  }>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  // Form fields
  const [userType, setUserType] = useState('');
  const [form, setForm] = useState<Record<string, any>>({});
  const [extraData, setExtraData] = useState<Record<string, any>>({});
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [showAddress, setShowAddress] = useState(false);

  // Parent/guardian (students only)
  const [father, setFather] = useState<ParentData>({});
  const [mother, setMother] = useState<ParentData>({});
  const [guardian, setGuardian] = useState<ParentData>({});
  const [showParents, setShowParents] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { mode: string; message: string; cardPending?: string[] }>(null);

  // Load config
  useEffect(() => {
    if (!token) return;
    registrationLinksApi.getPublicConfig(token)
      .then(cfg => {
        setConfig(cfg);
        setUserType(cfg.config.allowedUserTypes[0] ?? '');
      })
      .catch(e => setLoadError(e?.message?.replace(/^\d+:\s*/, '') ?? 'This registration link is unavailable.'));
  }, [token]);

  const cfg = config?.config;
  const phoneRequired = !!cfg?.requirePhoneVerification;
  const emailRequired = !!cfg?.requireEmailVerification;
  const isStudent = userType === 'STUDENT';

  // Email OTP countdown
  useEffect(() => {
    if (!emailExpiresAt || email.verified) { setEmailRemaining(null); return; }
    const tick = () => setEmailRemaining(Math.max(0, Math.floor((new Date(emailExpiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [emailExpiresAt, email.verified]);
  const emailExpired = emailRemaining !== null && emailRemaining <= 0;

  // Email verification actions
  const requestEmail = async () => {
    if (!token || !email.value || emailBusy) return;
    setEmailBusy(true);
    setSubmitError(null);
    try {
      const res = await registrationLinksApi.requestEmail(token, email.value);
      setEmail(p => ({ ...p, requested: true, existingUserId: res.existingUserId }));
      setEmailExpiresAt(res.expiresAt ?? null);
      setEmailCode('');
      setShowEmailVerify(true);
    } catch (e: any) {
      setSubmitError(e?.message?.replace(/^\d+:\s*/, '') ?? 'Failed to send email code.');
    } finally { setEmailBusy(false); }
  };

  const confirmEmail = async () => {
    if (!token || !email.value || !emailCode || emailBusy) return;
    setEmailBusy(true);
    setSubmitError(null);
    try {
      await registrationLinksApi.confirmEmail(token, email.value, emailCode);
      const currentEmail = email.value;
      const currentExistingId = email.existingUserId;
      setEmail(p => ({ ...p, verified: true }));
      setShowEmailVerify(false);
      if (currentExistingId) runExistingLookup({ email: currentEmail }, currentExistingId);
    } catch (e: any) {
      setSubmitError(e?.message?.replace(/^\d+:\s*/, '') ?? 'Invalid or expired code.');
    } finally { setEmailBusy(false); }
  };

  // Existing-account lookup — called once we have a verified matching contact
  const runExistingLookup = useCallback(async (params: { phoneNumber?: string; email?: string }, _existingId: string) => {
    if (!token || existing) return;
    setLookupBusy(true);
    try {
      const res = await registrationLinksApi.lookupExisting(token, params);
      setExisting(res);
      // Pre-fill form from existing account
      setForm(prev => ({ ...res.filled, ...prev }));
    } catch (e: any) {
      setSubmitError(e?.message?.replace(/^\d+:\s*/, '') ?? 'Could not load your account.');
    } finally { setLookupBusy(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, existing]);

  const setField = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const setExtraField = (k: string, v: any) => setExtraData(p => ({ ...p, [k]: v }));

  const selectedClass = config?.classes.find(c => c.classId === selectedClassId);

  const parentHasContact = (p: ParentData) => !!(p.email || p.phoneNumber);
  const anyParentProvided = parentHasContact(father) || parentHasContact(mother) || parentHasContact(guardian);

  const cleanParent = (p: ParentData) => {
    if (!p.firstName && !p.phoneNumber && !p.email) return undefined;
    return {
      firstName: p.firstName || undefined,
      lastName: p.lastName || undefined,
      nameWithInitials: p.nameWithInitials || undefined,
      email: p.email || undefined,
      phoneNumber: p.phoneNumber || undefined,
      dateOfBirth: p.dateOfBirth || undefined,
      gender: p.gender || undefined,
      nic: p.nic || undefined,
      birthCertificateNo: p.birthCertificateNo || undefined,
      educationLevel: p.educationLevel || undefined,
      occupation: p.occupation || undefined,
      workplace: p.workplace || undefined,
      addressLine1: p.addressLine1 || undefined,
      city: p.city || undefined,
      district: p.district || undefined,
      province: p.province || undefined,
      postalCode: p.postalCode || undefined,
      existingUserId: p.existingUserId || undefined,
    };
  };

  const handleSubmit = async () => {
    if (!token || !cfg) return;
    setSubmitError(null);

    // Required contact verification checks
    if (phoneRequired && !phone.verified) {
      setSubmitError('Phone number verification is required. Enter and verify your phone number above.');
      return;
    }
    if (emailRequired && !email.verified) {
      setSubmitError('Email verification is required. Enter and verify your email above.');
      return;
    }
    // If they typed a contact but didn't verify it, warn
    if (phone.value && !phone.verified) {
      setSubmitError('You entered a phone number but have not verified it. Please verify or clear it.');
      return;
    }
    if (email.value && !email.verified) {
      setSubmitError('You entered an email but have not verified it. Please verify or clear it.');
      return;
    }

    // Required custom columns
    const missingRequired = cfg.customColumns.find(c => {
      if (!c.required) return false;
      const v = extraData[c.key];
      return v === undefined || v === null || v === '';
    });
    if (missingRequired) {
      setSubmitError(`"${missingRequired.label}" is required.`);
      return;
    }

    // Student contact rule
    if (isStudent) {
      const studentHasContact = !!(phone.value || email.value);
      if (!studentHasContact && !anyParentProvided) {
        setSubmitError('A student needs at least a phone or email, or a parent/guardian with a contact.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const classEnrollments = isStudent && cfg?.allowClassEnrollment && selectedClassId
        ? [{ classId: selectedClassId, subjectEnrollments: cfg?.allowSubjectEnrollment ? selectedSubjects.map(s => ({ subjectId: s })) : undefined }]
        : undefined;

      const payload: any = {
        existingUserId: existing?.existingUserId,
        instituteUserType: userType,
        phoneNumber: phone.value || undefined,
        email: email.value || undefined,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        nameWithInitials: form.nameWithInitials || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        nic: form.nic || undefined,
        addressLine1: form.addressLine1 || undefined,
        addressLine2: form.addressLine2 || undefined,
        city: form.city || undefined,
        district: form.district || undefined,
        province: form.province || undefined,
        postalCode: form.postalCode || undefined,
        father: isStudent ? cleanParent(father) : undefined,
        mother: isStudent ? cleanParent(mother) : undefined,
        guardian: isStudent ? cleanParent(guardian) : undefined,
        classEnrollments,
        extraData: Object.keys(extraData).length ? extraData : undefined,
      };

      const res = await registrationLinksApi.register(token, payload);
      setDone({ mode: res.mode, message: res.message, cardPending: res.cardPendingScopes });
    } catch (e: any) {
      setSubmitError(e?.message?.replace(/^\d+:\s*/, '') ?? 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render states ──
  if (loadError) {
    return (
      <Centered>
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-lg font-semibold">Link unavailable</h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </div>
      </Centered>
    );
  }
  if (!config) {
    return <Centered><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></Centered>;
  }
  if (done) {
    return (
      <Centered brandColor={config.institute.primaryColorCode}>
        <div className="text-center space-y-3 max-w-md">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
          <h1 className="text-xl font-bold">Registration submitted</h1>
          <p className="text-sm text-muted-foreground">{done.message}</p>
          {done.cardPending?.length ? (
            <p className="text-xs text-amber-600">A smart card could not be assigned now — the institute will assign one.</p>
          ) : null}
        </div>
      </Centered>
    );
  }

  const inst = config.institute;
  const locked = (k: string) => !!(existing && existing.filled[k] !== null && existing.filled[k] !== undefined && existing.filled[k] !== '');
  const filledVal = (k: string) => existing?.filled[k] ?? '';

  return (
    <div className="fixed inset-0 overflow-y-auto bg-muted/30 py-8 px-4">
      <div className="max-w-lg mx-auto">

        {/* Branding */}
        <div className="text-center mb-6">
          {inst.logoUrl && (
            <img src={getImageUrl(inst.logoUrl)} alt={inst.name} className="h-16 mx-auto object-contain mb-3" />
          )}
          <h1 className="text-xl font-bold">{inst.welcomeTitle || `Register with ${inst.name}`}</h1>
          <p className="text-sm text-muted-foreground">{inst.welcomeSubtitle || 'Complete the form below to request enrollment.'}</p>
        </div>

        <div className="bg-card rounded-xl border p-5 space-y-5">

          {/* Error banner */}
          {submitError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" /> {submitError}
            </div>
          )}

          {/* Existing-account banner */}
          {existing && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
              <UserPlus className="h-4 w-4 shrink-0" />
              We found your existing Suraksha account. Known fields are pre-filled — just complete what's missing to join {inst.name}.
            </div>
          )}
          {lookupBusy && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for existing account…</p>
          )}

          {/* User type */}
          {cfg!.allowedUserTypes.length > 1 ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">I am registering as</Label>
              <Select value={userType} onValueChange={v => { setUserType(v); setFather({}); setMother({}); setGuardian({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cfg!.allowedUserTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Registering as <strong>{userType}</strong></p>
          )}

          {/* ── Personal Information ── */}
          <div className="space-y-3">
            <SectionHeader>Personal Information</SectionHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PField label="First name" k="firstName" form={form} setField={setField} locked={locked} filledVal={filledVal} />
              <PField label="Last name" k="lastName" form={form} setField={setField} locked={locked} filledVal={filledVal} />
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-sm">Name with initials</Label>
                <Input
                  placeholder="e.g., K. D. Perera"
                  value={locked('nameWithInitials') ? filledVal('nameWithInitials') : (form.nameWithInitials ?? '')}
                  disabled={locked('nameWithInitials')}
                  onChange={e => setField('nameWithInitials', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Auto-generated from first/last name if left blank</p>
              </div>

              {/* Phone — inline verification */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Phone number{phoneRequired ? ' *' : ''}
                  {phone.verified && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline ml-1.5" />}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={phone.value}
                    disabled={phone.verified || showPhoneVerify}
                    onChange={e => { setPhone(p => ({ ...p, value: e.target.value })); setShowPhoneVerify(false); }}
                    placeholder="+9477XXXXXXX"
                    className="flex-1"
                  />
                  {phone.value && !phone.verified && !showPhoneVerify && (
                    <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setShowPhoneVerify(true)}>
                      Verify
                    </Button>
                  )}
                  {phone.value && !phone.verified && showPhoneVerify && (
                    <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setShowPhoneVerify(false)}>
                      Hide
                    </Button>
                  )}
                </div>
                {showPhoneVerify && !phone.verified && phone.value && (
                  <div className="mt-1">
                    <WhatsAppPhoneVerify
                      key={phone.value}
                      phoneNumber={phone.value}
                      autoPoll
                      requestFn={async (pn) => {
                        const r = await registrationLinksApi.requestPhone(token!, pn);
                        setPhone(p => ({ ...p, existingUserId: r.existingUserId }));
                        return { waLink: r.waLink, expiresAt: r.expiresAt, existingUserId: r.existingUserId };
                      }}
                      statusFn={(pn) => registrationLinksApi.phoneStatus(token!, pn)}
                      onExisting={(id) => setPhone(p => ({ ...p, existingUserId: id }))}
                      onVerified={() => {
                        // Read existingUserId from the ref'd state via callback to avoid stale closure
                        setPhone(p => {
                          const updated = { ...p, verified: true };
                          if (updated.existingUserId) {
                            setTimeout(() => runExistingLookup({ phoneNumber: updated.value }, updated.existingUserId!), 0);
                          }
                          return updated;
                        });
                        setShowPhoneVerify(false);
                      }}
                    />
                  </div>
                )}
                {phoneRequired && !phone.value && (
                  <p className="text-[11px] text-muted-foreground">Required — enter and verify your WhatsApp number.</p>
                )}
              </div>

              {/* Email — inline verification */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Email{emailRequired ? ' *' : ''}
                  {email.verified && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline ml-1.5" />}
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={email.value}
                    disabled={email.verified || email.requested}
                    onChange={e => { setEmail(p => ({ ...p, value: e.target.value, requested: false })); setShowEmailVerify(false); setEmailCode(''); }}
                    placeholder="user@email.com"
                    className="flex-1"
                  />
                  {email.value && !email.verified && !email.requested && (
                    <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={requestEmail} disabled={emailBusy}>
                      {emailBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send code'}
                    </Button>
                  )}
                  {email.verified && (
                    <span className="text-xs text-green-600 flex items-center shrink-0">Verified</span>
                  )}
                </div>
                {email.requested && !email.verified && (
                  <div className="space-y-1.5 mt-1">
                    <div className="flex gap-2">
                      <Input
                        value={emailCode}
                        onChange={e => setEmailCode(e.target.value)}
                        placeholder="6-digit code"
                        maxLength={6}
                        inputMode="numeric"
                        className="flex-1"
                      />
                      <Button type="button" size="sm" onClick={confirmEmail} disabled={!emailCode || emailBusy || emailExpired} className="shrink-0">
                        {emailBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      {emailRemaining !== null && (
                        <p className={`text-[11px] flex items-center gap-1 ${emailExpired ? 'text-red-600' : 'text-muted-foreground'}`}>
                          <Clock className="h-3 w-3" />
                          {emailExpired ? 'Code expired' : `Expires in ${fmtMMSS(emailRemaining)}`}
                        </p>
                      )}
                      <Button type="button" variant="ghost" size="sm" className="text-[11px] h-auto py-0 px-1" onClick={requestEmail} disabled={emailBusy || (!emailExpired && !!emailRemaining && emailRemaining > 0)}>
                        Resend
                      </Button>
                    </div>
                  </div>
                )}
                {emailRequired && !email.value && (
                  <p className="text-[11px] text-muted-foreground">Required — enter and verify your email address.</p>
                )}
              </div>

              {/* Other identity fields */}
              <div className="space-y-1">
                <Label className="text-sm">Gender</Label>
                {locked('gender') ? (
                  <Input value={filledVal('gender')} disabled />
                ) : (
                  <Select value={form.gender ?? ''} onValueChange={v => setField('gender', v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <PField label="Date of birth" k="dateOfBirth" type="date" form={form} setField={setField} locked={locked} filledVal={filledVal} />
              <PField label="NIC / Birth certificate no." k="nic" form={form} setField={setField} locked={locked} filledVal={filledVal} className="sm:col-span-2" />
            </div>
          </div>

          {/* ── Address (collapsible) ── */}
          <div className="space-y-2">
            <button type="button" onClick={() => setShowAddress(a => !a)} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              {showAddress ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Address Details
            </button>
            {showAddress && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-3 border-l-2 border-primary/20">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-sm">Address Line 1</Label>
                  <Input placeholder="Street address" value={form.addressLine1 ?? ''} onChange={e => setField('addressLine1', e.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-sm">Address Line 2</Label>
                  <Input placeholder="Apt, suite, etc." value={form.addressLine2 ?? ''} onChange={e => setField('addressLine2', e.target.value)} />
                </div>
                <div className="space-y-1"><Label className="text-sm">City</Label><Input placeholder="City" value={form.city ?? ''} onChange={e => setField('city', e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-sm">District</Label><Input placeholder="District" value={form.district ?? ''} onChange={e => setField('district', e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-sm">Province</Label><Input placeholder="Province" value={form.province ?? ''} onChange={e => setField('province', e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-sm">Postal Code</Label><Input placeholder="Postal code" maxLength={6} value={form.postalCode ?? ''} onChange={e => setField('postalCode', e.target.value)} /></div>
              </div>
            )}
          </div>

          {/* ── Class & Subject Enrollment (students only) ── */}
          {cfg!.allowClassEnrollment && isStudent && config.classes.length > 0 && (
            <div className="space-y-3">
              <SectionHeader><GraduationCap className="h-4 w-4 inline mr-1" />Class Enrollment</SectionHeader>
              <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSelectedSubjects([]); }}>
                <SelectTrigger><SelectValue placeholder="Select a class to enroll" /></SelectTrigger>
                <SelectContent>
                  {config.classes.map(c => (
                    <SelectItem key={c.classId} value={c.classId}>{c.name}{c.grade ? ` (Grade ${c.grade})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cfg!.allowSubjectEnrollment && selectedClass && selectedClass.subjects.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Subjects (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedClass.subjects.map(s => (
                      <label key={s.subjectId} className="flex items-center gap-1.5 text-xs border rounded-full px-2.5 py-1 cursor-pointer hover:bg-muted/50">
                        <Checkbox
                          checked={selectedSubjects.includes(s.subjectId)}
                          onCheckedChange={v => setSelectedSubjects(prev => v ? [...prev, s.subjectId] : prev.filter(x => x !== s.subjectId))}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Parent / Guardian (students only, collapsible) ── */}
          {isStudent && (
            <div className="space-y-2">
              <button type="button" onClick={() => setShowParents(p => !p)} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                {showParents ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Parent / Guardian Info
              </button>
              {!showParents && (
                <p className="text-[11px] text-muted-foreground pl-5">
                  Required if the student has no personal phone/email.
                </p>
              )}
              {showParents && (
                <div className="space-y-2 pl-3 border-l-2 border-primary/20">
                  <ParentSection token={token!} label="Father" value={father} onChange={setFather} onRecord={existing?.hasFather} />
                  <ParentSection token={token!} label="Mother" value={mother} onChange={setMother} onRecord={existing?.hasMother} />
                  <ParentSection token={token!} label="Guardian" value={guardian} onChange={setGuardian} onRecord={existing?.hasGuardian} />
                </div>
              )}
            </div>
          )}

          {/* ── Institute custom columns ── */}
          {cfg!.customColumns.length > 0 && (
            <div className="space-y-3">
              <SectionHeader>Additional Information</SectionHeader>
              {cfg!.customColumns.map(col => (
                <div key={col.key} className="space-y-1">
                  <Label className="text-sm">
                    {col.label}{col.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  {col.type === 'select' && col.options?.length ? (
                    <Select value={extraData[col.key] ?? ''} onValueChange={v => setExtraField(col.key, v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {col.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : col.type === 'boolean' ? (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={extraData[col.key] === true || extraData[col.key] === 'true'}
                        onCheckedChange={v => setExtraField(col.key, !!v)}
                      />
                      Yes
                    </label>
                  ) : (
                    <Input
                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : col.type === 'email' ? 'email' : 'text'}
                      value={extraData[col.key] ?? ''}
                      onChange={e => setExtraField(col.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          <div className="border-t pt-4 space-y-2">
            <Button className="w-full h-11" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit registration
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              Your registration will be reviewed and approved by {inst.name}.
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">Powered by Suraksha LMS</p>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-semibold text-sm text-foreground border-l-2 border-primary pl-3 py-0.5">{children}</h3>
  );
}

function PField({
  label, k, type = 'text', form, setField, locked, filledVal, className,
}: {
  label: string;
  k: string;
  type?: string;
  form: Record<string, any>;
  setField: (k: string, v: any) => void;
  locked: (k: string) => boolean;
  filledVal: (k: string) => any;
  className?: string;
}) {
  const isLocked = locked(k);
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <Label className="text-sm">{label}</Label>
      <Input
        type={type}
        value={isLocked ? filledVal(k) : (form[k] ?? '')}
        disabled={isLocked}
        onChange={e => setField(k, e.target.value)}
      />
    </div>
  );
}

function Centered({ children, brandColor }: { children: React.ReactNode; brandColor?: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4" style={brandColor ? { borderTop: `4px solid ${brandColor}` } : undefined}>
      {children}
    </div>
  );
}
