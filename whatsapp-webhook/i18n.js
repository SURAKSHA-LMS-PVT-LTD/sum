'use strict';

/**
 * i18n strings for the WhatsApp attendance bot.
 *
 * Data-driven table — add a language by adding one entry. Names
 * (student/institute/class/subject) stay in English as stored; only structural
 * phrasing is translated. Default language: Sinhala ('S').
 *
 * Language codes match users.language: 'S' Sinhala, 'E' English, 'T' Tamil.
 */

const STATUS_LABEL = {
  S: { 0: 'නොපැමිණි', 1: 'පැමිණි', 2: 'ප්‍රමාද', 3: 'පිටව ගිය', 4: 'කලින් පිටව ගිය', 5: 'ප්‍රමාදව පිටව ගිය' },
  E: { 0: 'Absent', 1: 'Present', 2: 'Late', 3: 'Left', 4: 'Left Early', 5: 'Left Lately' },
  T: { 0: 'வரவில்லை', 1: 'வந்தார்', 2: 'தாமதம்', 3: 'வெளியேறினார்', 4: 'முன் வெளியேறினார்', 5: 'தாமத வெளியேற்றம்' },
};

const STRINGS = {
  S: {
    // Attendance reply
    historyHeader: (who) => `📋 *${who}* — අවසන් පැමිණීම් වාර්තා 10`,
    instituteLine: (inst) => `🏫 ${inst}`,
    noRecords: 'මෙම සිසුවා සඳහා පැමිණීම් වාර්තා නොමැත.',
    summary: (present, total) => `📊 පැමිණි දින ${present}/${total}`,
    userIdLine: (id) => `🆔 ඔබගේ සුරක්ෂා LMS පරිශීලක අංකය: *${id}*`,
    // Menu
    menuBody: '👋 ආයුබෝවන්! පහතින් සිසුවෙකු තෝරා පැමිණීම් බලන්න.',
    menuButton: 'තෝරන්න',
    menuHeader: 'ඔබගේ සිසුන්',
    rowAttendanceSuffix: 'පැමිණීම',
    typedFallbackIntro: '👋 ආයුබෝවන්! පැමිණීම් අවශ්‍ය සිසුවාගේ *අංකය* එවන්න:',
    // Errors / notices
    notRegistered: 'ඔබ ලියාපදිංචි වී නැත.',
    noInstitute: '⚠️ ඔබ කිසිදු ක්‍රියාකාරී ආයතනයක ලියාපදිංචි වී නැත. කරුණාකර ආයතන පරිපාලකයා අමතන්න.',
    childNoInstitute: (name) => `⚠️ ${name} කිසිදු ක්‍රියාකාරී ආයතනයක ලියාපදිංචි වී නැත.`,
    noChildren: '⚠️ ඔබගේ ගිණුමට සිසුන් සම්බන්ධ කර නැත.\nකරුණාකර ආයතන පරිපාලකයා අමතන්න.',
    childRemoved: '⚠️ එම සිසුවා තවදුරටත් ඔබගේ ගිණුමට සම්බන්ධ නැත. වත්මන් ලැයිස්තුව සඳහා *hi* එවන්න.',
    noWaAccess: '⚠️ ඔබගේ ගිණුම් වර්ගයට WhatsApp හරහා පැමිණීම් ප්‍රවේශය නැත.\nකරුණාකර Suraksha LMS යෙදුම භාවිතා කරන්න.',
  },
  E: {
    historyHeader: (who) => `📋 *${who}* — Last 10 records`,
    instituteLine: (inst) => `🏫 ${inst}`,
    noRecords: 'No attendance records found for this student.',
    summary: (present, total) => `📊 Present ${present}/${total} days`,
    userIdLine: (id) => `🆔 Your Suraksha LMS user ID is *${id}*`,
    menuBody: '👋 Hello! Tap below to choose a student and view their attendance.',
    menuButton: 'Choose student',
    menuHeader: 'Your students',
    rowAttendanceSuffix: 'Attendance',
    typedFallbackIntro: '👋 Hello! Reply with the *number* of the student whose attendance you want:',
    notRegistered: 'You are not registered.',
    noInstitute: '⚠️ You are enrolled in no active institute. Please contact your institute admin.',
    childNoInstitute: (name) => `⚠️ ${name} is not enrolled in any active institute.`,
    noChildren: '⚠️ No students are linked to your account.\nPlease contact your institute admin to link your child.',
    childRemoved: '⚠️ That student is no longer linked to your account. Send *hi* to see the current list.',
    noWaAccess: '⚠️ Your account type does not have attendance access via WhatsApp.\nPlease use the Suraksha LMS app.',
  },
  T: {
    historyHeader: (who) => `📋 *${who}* — சமீபத்திய 10 பதிவுகள்`,
    instituteLine: (inst) => `🏫 ${inst}`,
    noRecords: 'இந்த மாணவருக்கு வருகைப் பதிவுகள் இல்லை.',
    summary: (present, total) => `📊 வருகை ${present}/${total} நாட்கள்`,
    userIdLine: (id) => `🆔 உங்கள் சுரக்ஷா LMS பயனர் ஐடி: *${id}*`,
    menuBody: '👋 வணக்கம்! மாணவரைத் தேர்ந்தெடுத்து வருகையைப் பாருங்கள்.',
    menuButton: 'தேர்வு செய்க',
    menuHeader: 'உங்கள் மாணவர்கள்',
    rowAttendanceSuffix: 'வருகை',
    typedFallbackIntro: '👋 வணக்கம்! வருகை வேண்டிய மாணவரின் *எண்ணை* அனுப்பவும்:',
    notRegistered: 'நீங்கள் பதிவு செய்யப்படவில்லை.',
    noInstitute: '⚠️ நீங்கள் எந்த செயலில் உள்ள நிறுவனத்திலும் சேரவில்லை. நிர்வாகியைத் தொடர்பு கொள்ளவும்.',
    childNoInstitute: (name) => `⚠️ ${name} எந்த செயலில் உள்ள நிறுவனத்திலும் சேரவில்லை.`,
    noChildren: '⚠️ உங்கள் கணக்குடன் மாணவர்கள் இணைக்கப்படவில்லை.\nநிர்வாகியைத் தொடர்பு கொள்ளவும்.',
    childRemoved: '⚠️ அந்த மாணவர் இனி உங்கள் கணக்குடன் இணைக்கப்படவில்லை. தற்போதைய பட்டியலுக்கு *hi* அனுப்பவும்.',
    noWaAccess: '⚠️ உங்கள் கணக்கு வகைக்கு WhatsApp வழியாக வருகை அணுகல் இல்லை.\nSuraksha LMS பயன்பாட்டைப் பயன்படுத்தவும்.',
  },
};

/** Resolve a raw language value (DB column, etc.) to a supported code. Default 'S'. */
function resolveLang(raw) {
  if (!raw) return 'S';
  const v = String(raw).trim().toUpperCase();
  if (v === 'E' || v === 'EN' || v === 'ENGLISH') return 'E';
  if (v === 'T' || v === 'TA' || v === 'TAMIL') return 'T';
  return 'S';
}

/** Get the strings table for a language code (falls back to Sinhala). */
function t(lang) {
  return STRINGS[lang] || STRINGS.S;
}

/** Localized status word. */
function statusLabel(lang, code) {
  const table = STATUS_LABEL[lang] || STATUS_LABEL.S;
  return table[code] ?? table[0];
}

module.exports = { resolveLang, t, statusLabel };
