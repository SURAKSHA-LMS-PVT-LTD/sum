/**
 * Helper utilities for Card Management
 */

import { CardStatus, OrderStatus, PaymentStatus } from '@/api/userCard.api';

// ============================================
// STATUS BADGE COLORS
// ============================================

export const orderStatusColors: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_PAYMENT]: 'bg-gray-100 text-gray-800 border-gray-200',
  [OrderStatus.PAYMENT_RECEIVED]: 'bg-blue-100 text-blue-800 border-blue-200',
  [OrderStatus.VERIFYING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [OrderStatus.VERIFIED]: 'bg-green-100 text-green-800 border-green-200',
  [OrderStatus.PREPARING]: 'bg-purple-100 text-purple-800 border-purple-200',
  [OrderStatus.PRINTING]: 'bg-purple-100 text-purple-800 border-purple-200',
  [OrderStatus.DELIVERING]: 'bg-blue-100 text-blue-800 border-blue-200',
  [OrderStatus.ON_THE_WAY]: 'bg-blue-100 text-blue-800 border-blue-200',
  [OrderStatus.DELIVERED]: 'bg-green-100 text-green-800 border-green-200',
  [OrderStatus.CANCELLED]: 'bg-red-100 text-red-800 border-red-200',
  [OrderStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-200',
};

export const cardStatusColors: Record<CardStatus, string> = {
  [CardStatus.ACTIVE]: 'bg-green-100 text-green-800 border-green-200',
  [CardStatus.INACTIVE]: 'bg-gray-100 text-gray-800 border-gray-200',
  [CardStatus.DEACTIVATED]: 'bg-orange-100 text-orange-800 border-orange-200',
  [CardStatus.EXPIRED]: 'bg-red-100 text-red-800 border-red-200',
  [CardStatus.LOST]: 'bg-red-100 text-red-800 border-red-200',
  [CardStatus.DAMAGED]: 'bg-red-100 text-red-800 border-red-200',
  [CardStatus.REPLACED]: 'bg-blue-100 text-blue-800 border-blue-200',
};

export const paymentStatusColors: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [PaymentStatus.VERIFIED]: 'bg-green-100 text-green-800 border-green-200',
  [PaymentStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-200',
};

// ============================================
// STATUS LABELS
// ============================================

export const orderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_PAYMENT]: 'Pending Payment',
  [OrderStatus.PAYMENT_RECEIVED]: 'Payment Received',
  [OrderStatus.VERIFYING]: 'Verifying',
  [OrderStatus.VERIFIED]: 'Verified',
  [OrderStatus.PREPARING]: 'Preparing',
  [OrderStatus.PRINTING]: 'Printing',
  [OrderStatus.DELIVERING]: 'Delivering',
  [OrderStatus.ON_THE_WAY]: 'On The Way',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
  [OrderStatus.REJECTED]: 'Rejected',
};

export const cardStatusLabels: Record<CardStatus, string> = {
  [CardStatus.ACTIVE]: 'Active',
  [CardStatus.INACTIVE]: 'Inactive',
  [CardStatus.DEACTIVATED]: 'Deactivated',
  [CardStatus.EXPIRED]: 'Expired',
  [CardStatus.LOST]: 'Lost',
  [CardStatus.DAMAGED]: 'Damaged',
  [CardStatus.REPLACED]: 'Replaced',
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'Pending',
  [PaymentStatus.VERIFIED]: 'Verified',
  [PaymentStatus.REJECTED]: 'Rejected',
};

// ============================================
// DATE FORMATTING
// ============================================

export const formatDate = (isoString: string): string => {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (isoString: string): string => {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Returns a human-friendly relative date string for recent dates.
 * - "just now" (< 1 min)
 * - "X minutes ago" (< 1 hour)
 * - "X hours ago" (< 24 hours)
 * - "X days ago" (< 14 days)
 * - Falls back to formatted date for older entries
 */
export const formatRelativeDate = (isoString: string): string => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 14) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return formatDate(isoString);
};


export const isExpiringSoon = (expiryDate: string): boolean => {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
};

export const getDaysUntilExpiry = (expiryDate: string): number => {
  const expiry = new Date(expiryDate);
  const now = new Date();
  return Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

// ============================================
// PRICE FORMATTING
// ============================================

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(price);
};

// ============================================
// PHONE VALIDATION
// ============================================

export const isValidSriLankanPhone = (phone: string): boolean => {
  return /^\+94\d{9}$/.test(phone);
};

export const formatPhoneForDisplay = (phone: string): string => {
  if (phone.startsWith('+94')) {
    return `+94 ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  }
  return phone;
};
