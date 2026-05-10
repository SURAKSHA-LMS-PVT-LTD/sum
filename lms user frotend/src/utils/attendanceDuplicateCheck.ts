/**
 * Local Duplicate Attendance Prevention System
 * 
 * Keeps track of the last 5 attendance markings per user to prevent duplicates.
 * This is a client-side check to avoid unnecessary API calls.
 */

import { AttendanceStatus } from '@/types/attendance.types';

interface AttendanceRecord {
  userId: string;
  studentId?: string;
  studentCardId?: string;
  instituteId: string;
  classId?: string;
  subjectId?: string;
  status: AttendanceStatus;
  timestamp: number;
  method: 'manual' | 'qr' | 'barcode' | 'rfid/nfc';
}

const STORAGE_KEY = 'recent_attendance_marks';
const MAX_RECORDS = 5;
const DUPLICATE_CHECK_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

class AttendanceDuplicateChecker {
  private records: AttendanceRecord[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load records from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter out old records (older than 5 minutes)
        const now = Date.now();
        this.records = parsed.filter(
          (record: AttendanceRecord) => now - record.timestamp < DUPLICATE_CHECK_WINDOW_MS
        );
      }
    } catch (error: any) {
      console.error('Failed to load attendance records from storage:', error);
      this.records = [];
    }
  }

  /**
   * Save records to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch (error: any) {
      console.error('Failed to save attendance records to storage:', error);
    }
  }

  /**
   * Check if this attendance marking is a duplicate
   */
  isDuplicate(params: {
    userId: string;
    studentId?: string;
    studentCardId?: string;
    instituteId: string;
    classId?: string;
    subjectId?: string;
    status: AttendanceStatus;
    method: 'manual' | 'qr' | 'barcode' | 'rfid/nfc';
  }): boolean {
    const now = Date.now();

    // Find matching record
    const duplicate = this.records.find(record => {
      // Check if within time window
      if (now - record.timestamp > DUPLICATE_CHECK_WINDOW_MS) {
        return false;
      }

      // Match user ID
      if (record.userId !== params.userId) {
        return false;
      }

      // Match institute
      if (record.instituteId !== params.instituteId) {
        return false;
      }

      // Match student (either by studentId or studentCardId)
      const studentMatch = 
        (params.studentId && record.studentId === params.studentId) ||
        (params.studentCardId && record.studentCardId === params.studentCardId);

      if (!studentMatch) {
        return false;
      }

      // Match class exactly (selection-wise)
      // - If one mark is "institute-only" (no class) and the other is "class" -> NOT duplicate
      const recordClassId = record.classId ?? null;
      const paramsClassId = params.classId ?? null;
      if (recordClassId !== paramsClassId) {
        return false;
      }

      // Match subject exactly (selection-wise)
      const recordSubjectId = record.subjectId ?? null;
      const paramsSubjectId = params.subjectId ?? null;
      if (recordSubjectId !== paramsSubjectId) {
        return false;
      }

      // Note: We intentionally do NOT match status here.
      // If the same student is marked again (even with a different status) within the window,
      // we treat it as a duplicate and block for 5 minutes.


      // All checks passed - this is a duplicate
      return true;
    });

    if (duplicate) {
      const timeSince = Math.round((now - duplicate.timestamp) / 1000);
      console.warn('🚫 DUPLICATE ATTENDANCE DETECTED!');
      console.warn('Last marked:', timeSince, 'seconds ago');
      console.warn('Duplicate Record:', duplicate);
      console.warn('Current Attempt:', params);
      return true;
    }

    return false;
  }

  /**
   * Record a new attendance marking
   */
  recordAttendance(params: {
    userId: string;
    studentId?: string;
    studentCardId?: string;
    instituteId: string;
    classId?: string;
    subjectId?: string;
    status: AttendanceStatus;
    method: 'manual' | 'qr' | 'barcode' | 'rfid/nfc';
  }): void {
    const record: AttendanceRecord = {
      ...params,
      timestamp: Date.now()
    };

    // Add new record at the beginning
    this.records.unshift(record);

    // Keep only last MAX_RECORDS
    this.records = this.records.slice(0, MAX_RECORDS);

    // Clean old records
    const now = Date.now();
    this.records = this.records.filter(
      r => now - r.timestamp < DUPLICATE_CHECK_WINDOW_MS
    );

    // Save to storage
    this.saveToStorage();

    console.log('✅ Attendance recorded locally');
    console.log('📋 Recent Records:', this.records.length);
    console.log('Latest:', record);
  }

  /**
   * Get recent attendance records
   */
  getRecentRecords(): AttendanceRecord[] {
    return [...this.records];
  }

  /**
   * Clear all records (useful for logout)
   */
  clearAll(): void {
    this.records = [];
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ All attendance records cleared');
  }

  /**
   * Clear records for a specific user
   */
  clearForUser(userId: string): void {
    this.records = this.records.filter(record => record.userId !== userId);
    this.saveToStorage();
    console.log('🗑️ Attendance records cleared for user:', userId);
  }
}

// Singleton instance
export const attendanceDuplicateChecker = new AttendanceDuplicateChecker();

// Export for testing
export type { AttendanceRecord };
