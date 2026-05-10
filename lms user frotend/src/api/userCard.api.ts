/**
 * User Card Management API
 * Handles NFC, PVC, and Temporary ID cards with complete order lifecycle
 */

import { enhancedCachedClient } from './enhancedCachedClient';
import { apiClient } from './client';

// ============================================
// ENUMS
// ============================================

export enum CardType {
  NFC = 'NFC',
  PVC = 'PVC',
  TEMPORARY = 'TEMPORARY'
}

export enum CardStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEACTIVATED = 'DEACTIVATED',
  EXPIRED = 'EXPIRED',
  LOST = 'LOST',
  DAMAGED = 'DAMAGED',
  REPLACED = 'REPLACED'
}

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  VERIFYING = 'VERIFYING',
  VERIFIED = 'VERIFIED',
  PREPARING = 'PREPARING',
  PRINTING = 'PRINTING',
  DELIVERING = 'DELIVERING',
  ON_THE_WAY = 'ON_THE_WAY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED'
}

export enum PaymentType {
  BANK_TRANSFER = 'BANK_TRANSFER',
  SLIP_UPLOAD = 'SLIP_UPLOAD',
  VISA_MASTER = 'VISA_MASTER'
}

export enum UploadMethod {
  CLOUD_STORAGE = 'CLOUD_STORAGE',
  GOOGLE_DRIVE = 'GOOGLE_DRIVE'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

// ============================================
// INTERFACES
// ============================================

export interface Card {
  id: number;
  cardName: string;
  cardType: CardType;
  cardImageUrl: string | null;
  cardVideoUrl: string | null;
  description: string | null;
  price: number;
  quantityAvailable: number;
  validityDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CardPayment {
  id: number;
  orderId: number;
  submissionUrl: string;
  paymentType: PaymentType;
  paymentAmount: number;
  paymentReference: string | null;
  paymentStatus: PaymentStatus;
  verifiedBy: number | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  order?: UserIdCardOrder;
}

export interface UserIdCardOrder {
  id: number;
  userId: number;
  cardId: number;
  cardType: CardType;
  paymentId: number | null;
  cardExpiryDate: string;
  status: CardStatus;
  orderStatus: OrderStatus;
  rejectedReason: string | null;
  orderDate: string;
  deliveryAddress: string;
  contactPhone: string;
  notes: string | null;
  trackingNumber: string | null;
  rfidNumber: string | null;
  deliveredAt: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  card?: Card;
  payment?: CardPayment;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedCardsResponse {
  data: Card[];
  meta: PaginationMeta;
}

export interface PaginatedOrdersResponse {
  data: UserIdCardOrder[];
  meta: PaginationMeta;
}

// ============================================
// QUERY PARAMS
// ============================================

export interface CardsQueryParams {
  page?: number;
  limit?: number;
  cardType?: CardType;
  search?: string;
}

export interface OrdersQueryParams {
  page?: number;
  limit?: number;
  orderStatus?: OrderStatus;
  cardType?: CardType;
}

export interface MyCardsQueryParams {
  page?: number;
  limit?: number;
  cardType?: CardType;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface CreateOrderRequest {
  cardId: number;
  deliveryAddress: string;
  contactPhone: string;
  notes?: string;
}

export interface SubmitPaymentRequest {
  submissionUrl: string;
  paymentType: PaymentType;
  paymentAmount: number;
  paymentReference?: string;
  notes?: string;
}

export interface SubmitDrivePaymentRequest {
  driveFileId: string;
  driveWebViewLink: string;
  driveFileName?: string;
  paymentType: PaymentType;
  paymentAmount: number;
  paymentReference?: string;
  notes?: string;
}

export interface SignedUploadUrlRequest {
  fileName: string;
  contentType: string;
}

export interface SignedUploadUrlResponse {
  uploadUrl: string;
  relativePath: string;
  expiresAt: string;
  maxFileSize: number;
  contentType: string;
  instructions: string;
  fields?: Record<string, string>;
}

export interface UpdateCardStatusRequest {
  status: CardStatus;
  notes?: string;
}

// ============================================
// API CLASS
// ============================================

class UserCardApi {
  /**
   * Browse available cards
   */
  async getCards(params?: CardsQueryParams, forceRefresh = false): Promise<PaginatedCardsResponse> {
    console.log('🎴 Fetching available cards:', params);
    return enhancedCachedClient.get<PaginatedCardsResponse>(
      '/user-card/cards',
      params,
      {
        forceRefresh,
        ttl: 10,
        useStaleWhileRevalidate: true
      }
    );
  }

  /**
   * Create a new card order (supports parent ordering for child)
   */
  async createOrder(data: CreateOrderRequest, forUserId?: string): Promise<UserIdCardOrder> {
    console.log('📝 Creating card order:', data, forUserId ? `for user ${forUserId}` : '');
    const url = forUserId ? `/user-card/orders?forUserId=${encodeURIComponent(forUserId)}` : '/user-card/orders';
    return apiClient.post<UserIdCardOrder>(url, data);
  }

  /**
   * Get signed upload URL for payment slip (Cloud Storage)
   */
  async getPaymentSlipUploadUrl(orderId: number, data: SignedUploadUrlRequest): Promise<SignedUploadUrlResponse> {
    console.log('📤 Getting signed upload URL:', orderId, data);
    return apiClient.post<SignedUploadUrlResponse>(`/user-card/orders/${orderId}/payment-slip/upload-url`, data);
  }

  /**
   * Submit payment for an order (Cloud Storage)
   */
  async submitPayment(orderId: number, data: SubmitPaymentRequest): Promise<CardPayment> {
    console.log('💳 Submitting payment for order:', orderId, data);
    return apiClient.post<CardPayment>(`/user-card/orders/${orderId}/payment`, data);
  }

  /**
   * Submit payment via Google Drive
   */
  async submitDrivePayment(orderId: number, data: SubmitDrivePaymentRequest): Promise<CardPayment> {
    console.log('💳 Submitting Drive payment for order:', orderId, data);
    return apiClient.post<CardPayment>(`/user-card/orders/${orderId}/payment/drive`, data);
  }

  /**
   * Get my orders (supports parent viewing child's orders)
   */
  async getMyOrders(params?: OrdersQueryParams, forceRefresh = false, forUserId?: string): Promise<PaginatedOrdersResponse> {
    console.log('📋 Fetching orders:', params, forUserId ? `for user ${forUserId}` : '');
    const queryParams = forUserId ? { ...params, forUserId } : params;
    return enhancedCachedClient.get<PaginatedOrdersResponse>(
      '/user-card/orders',
      queryParams,
      {
        forceRefresh,
        ttl: 5,
        useStaleWhileRevalidate: true
      }
    );
  }

  /**
   * Get order details
   */
  async getOrderDetails(orderId: number, forceRefresh = false): Promise<UserIdCardOrder> {
    console.log('📄 Fetching order details:', orderId);
    return enhancedCachedClient.get<UserIdCardOrder>(
      `/user-card/orders/${orderId}`,
      undefined,
      {
        forceRefresh,
        ttl: 5,
        useStaleWhileRevalidate: true
      }
    );
  }

  /**
   * Get my active & deactivated cards (supports parent viewing child's cards)
   */
  async getMyCards(params?: MyCardsQueryParams, forceRefresh = false, forUserId?: string): Promise<PaginatedOrdersResponse> {
    console.log('💳 Fetching cards:', params, forUserId ? `for user ${forUserId}` : '');
    const queryParams = forUserId ? { ...params, forUserId } : params;
    return enhancedCachedClient.get<PaginatedOrdersResponse>(
      '/user-card/my-cards',
      queryParams,
      {
        forceRefresh,
        ttl: 5,
        useStaleWhileRevalidate: true
      }
    );
  }

  /**
   * Update my card status (report lost/damaged/deactivate)
   */
  async updateMyCardStatus(orderId: number, data: UpdateCardStatusRequest): Promise<UserIdCardOrder> {
    console.log('🔄 Updating card status:', orderId, data);
    return apiClient.patch<UserIdCardOrder>(`/user-card/my-cards/${orderId}/status`, data);
  }

  /**
   * Cancel a pending order
   */
  async cancelOrder(orderId: number): Promise<UserIdCardOrder> {
    console.log('❌ Cancelling order:', orderId);
    return apiClient.patch<UserIdCardOrder>(`/user-card/orders/${orderId}/cancel`, {
      orderStatus: OrderStatus.CANCELLED
    });
  }
}

export const userCardApi = new UserCardApi();
