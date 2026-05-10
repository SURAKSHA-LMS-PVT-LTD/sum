/**
 * Attendance Scan Log — keeps the last 10 attendance responses in session.
 * 
 * Web: sessionStorage (cleared on tab close, NOT localStorage for security)
 * Mobile (Capacitor): in-memory only (secure)
 * 
 * Auto-cleanup: 15 minutes after the session ends (last scan + 15 min)
 */

import { Capacitor } from '@capacitor/core';

export interface ScanLogEntry {
  id: string;
  success: boolean;
  studentName?: string;
  studentId?: string;
  studentCardId?: string;
  imageUrl?: string;
  status?: string;
  errorMessage?: string;
  markedAt: number; // timestamp
}

const STORAGE_KEY = 'attendance_scan_log';
const MAX_ENTRIES = 10;
const CLEANUP_DELAY_MS = 15 * 60 * 1000; // 15 minutes

class AttendanceScanLogStore {
  private entries: ScanLogEntry[] = [];
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<() => void> = new Set();
  private isNative = Capacitor.isNativePlatform();

  constructor() {
    this.load();
  }

  private load(): void {
    if (this.isNative) return; // mobile: memory only
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw);
      }
    } catch {
      this.entries = [];
    }
  }

  private persist(): void {
    if (!this.isNative) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
      } catch { /* ignore */ }
    }
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  /** Subscribe to changes — returns unsubscribe function */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Add a new scan result (success or failure) */
  add(entry: Omit<ScanLogEntry, 'id' | 'markedAt'>): void {
    const newEntry: ScanLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      markedAt: Date.now(),
    };

    // Prepend (newest first)
    this.entries.unshift(newEntry);

    // Keep only last MAX_ENTRIES
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }

    this.persist();
    this.resetCleanupTimer();
  }

  /** Get all entries (newest first) */
  getAll(): ScanLogEntry[] {
    return [...this.entries];
  }

  /** Clear all entries */
  clear(): void {
    this.entries = [];
    if (!this.isNative) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    this.cancelCleanupTimer();
    this.notify();
  }

  /** Start 15-min auto-cleanup countdown (resets on each new scan) */
  private resetCleanupTimer(): void {
    this.cancelCleanupTimer();
    this.cleanupTimer = setTimeout(() => {
      console.log('🧹 Auto-clearing attendance scan log after 15 min inactivity');
      this.clear();
    }, CLEANUP_DELAY_MS);
  }

  private cancelCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Call when scanning session ends to start the 15-min countdown */
  endSession(): void {
    this.resetCleanupTimer();
  }
}

export const attendanceScanLog = new AttendanceScanLogStore();
