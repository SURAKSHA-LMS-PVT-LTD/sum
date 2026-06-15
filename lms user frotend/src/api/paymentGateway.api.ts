import { apiClient } from './client';

export interface GatewayCheckoutResult {
  orderId: string;
  gatewayUrl: string;
  fields: Record<string, string>;
  provider: string;
}

export interface GatewayOrderStatus {
  orderId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'CHARGEDBACK';
  creditsGranted: boolean;
  credits: number;
  amount: number;
  currency: string;
  provider: string;
  createdAt: string;
}

export interface UserPackageOrderStatus {
  orderId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'CHARGEDBACK';
  subscriptionPlan?: string;
  validityDays?: number;
  amount: number;
  currency: string;
  provider: string;
  createdAt: string;
}

export const paymentGatewayApi = {
  initiateCheckout: (
    instituteId: string,
    credits: number,
    provider = 'PAYHERE',
    platform: 'web' | 'app' = 'web',
    returnBaseUrl?: string,
  ): Promise<GatewayCheckoutResult> =>
    apiClient.post(`/payment-gateway/institutes/${instituteId}/checkout`, { credits, provider, platform, returnBaseUrl })
      .then((r: any) => r?.data ?? r),

  getOrderStatus: (instituteId: string, orderId: string): Promise<GatewayOrderStatus> =>
    apiClient.get(`/payment-gateway/institutes/${instituteId}/orders/${orderId}`)
      .then((r: any) => r?.data ?? r),

  listOrders: (instituteId: string, page = 1, limit = 20) =>
    apiClient.get(`/payment-gateway/institutes/${instituteId}/orders?page=${page}&limit=${limit}`)
      .then((r: any) => r?.data ?? r),

  initiateUserPackageCheckout: (
    packageId: string,
    quantity = 1,
    provider = 'PAYHERE',
    platform: 'web' | 'app' = 'web',
    returnBaseUrl?: string,
  ): Promise<GatewayCheckoutResult> =>
    apiClient.post('/payment-gateway/users/package-checkout', { packageId, quantity, provider, platform, returnBaseUrl })
      .then((r: any) => r?.data ?? r),

  getUserPackageOrderStatus: (orderId: string): Promise<UserPackageOrderStatus> =>
    apiClient.get(`/payment-gateway/users/package-orders/${orderId}`)
      .then((r: any) => r?.data ?? r),
};
