$f = 'D:\User\Desktop\surakshalms\lms-api-suraksha-lk\src\modules\attendance\attendance.service.ts'
$lines = Get-Content $f
# Keep lines 0..4245 (first 4246 lines, which end with the closing brace of bulkMarkSubjectAttendance)
$keep = $lines[0..4245]
Set-Content -Path $f -Value $keep -Encoding UTF8
Write-Host "Truncated to $($keep.Count) lines"
