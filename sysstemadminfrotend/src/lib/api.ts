const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://lmsapi.suraksha.lk";

// Memory-only token store — never touches localStorage (XSS-safe)
let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export const getAuthToken = () => _accessToken;

/** Opens a URL only when scheme is http(s) — blocks javascript: and data: injection */
export function safeOpenUrl(url: string | null | undefined): void {
  if (!url) return;
  try {
    const { protocol } = new URL(url);
    if (protocol === 'https:' || protocol === 'http:') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch {
    // malformed URL — ignore
  }
}

export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 — clear in-memory token and redirect
    if (response.status === 401) {
      _accessToken = null;
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      throw new Error('Session expired. Please login again.');
    }

    // Include server error message when available
    let details = "";
    try {
      const text = await response.text();
      details = text;
      const parsed = JSON.parse(text);
      const msg = parsed?.message || parsed?.details?.message || parsed?.error;
      if (typeof msg === "string" && msg.trim()) {
        throw new Error(msg);
      }
    } catch (e) {
      // If it's our intentional throw with the parsed message, re-throw it
      if (e instanceof Error && e.message && e.message !== details) {
        throw e;
      }
      // Otherwise it was a JSON parse error or text read error — fall through
    }

    throw new Error(
      details?.trim()
        ? `API Error: ${response.status} - ${details}`
        : `API Error: ${response.status}`
    );
  }

  // Some endpoints may return 204
  if (response.status === 204) return null;

  return response.json();
};

export const api = {
  // Auth (handled by AuthContext — kept here for reference)
  login: (identifier: string, password: string, rememberMe = false) =>
    apiRequest("/v2/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password, rememberMe }),
    }),

  // Users
  getUsers: (params: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
    userType?: string;
    phone?: string;
    gender?: string;
    city?: string;
    district?: string;
    province?: string;
    nic?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}) => {
    const q = new URLSearchParams();
    q.append('page', String(params.page || 1));
    q.append('limit', String(params.limit || 10));
    if (params.isActive !== undefined) q.append('isActive', String(params.isActive));
    if (params.search) q.append('search', params.search);
    if (params.userType) q.append('userType', params.userType);
    if (params.phone) q.append('phone', params.phone);
    if (params.gender) q.append('gender', params.gender);
    if (params.city) q.append('city', params.city);
    if (params.district) q.append('district', params.district);
    if (params.province) q.append('province', params.province);
    if (params.nic) q.append('nic', params.nic);
    if (params.sortBy) q.append('sortBy', params.sortBy);
    if (params.sortOrder) q.append('sortOrder', params.sortOrder);
    return apiRequest(`/users?${q.toString()}`);
  },

  createUser: (data: any) =>
    apiRequest("/users/comprehensive", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Institutes
  getInstitutes: (page = 1, limit = 10, isActive = true) =>
    apiRequest(`/institutes?page=${page}&limit=${limit}&isActive=${isActive}`),

  createInstitute: (data: any) =>
    apiRequest("/institutes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Tenant / Multi-Tenancy Management
  setInstituteSubdomain: (id: string, subdomain: string) =>
    apiRequest(`/v2/tenant/institutes/${id}/subdomain`, {
      method: "PATCH",
      body: JSON.stringify({ subdomain }),
    }),

  setInstituteCustomDomain: (id: string, domain: string) =>
    apiRequest(`/v2/tenant/institutes/${id}/custom-domain`, {
      method: "PATCH",
      body: JSON.stringify({ domain }),
    }),

  updateInstituteTier: (id: string, tier: string) =>
    apiRequest(`/v2/tenant/institutes/${id}/tier`, {
      method: "PATCH",
      body: JSON.stringify({ tier }),
    }),

  updateInstituteVisibility: (id: string, data: { isVisibleInApp?: boolean; isVisibleInWebSelector?: boolean }) =>
    apiRequest(`/v2/tenant/institutes/${id}/visibility`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateInstituteLoginBranding: (id: string, data: any) =>
    apiRequest(`/v2/tenant/institutes/${id}/login-branding`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getLoginBranding: (id: string) =>
    apiRequest(`/v2/tenant/institutes/${id}/login-branding`, { method: "GET" }),

  verifyInstituteCustomDomain: (id: string) =>
    apiRequest(`/v2/tenant/institutes/${id}/verify-domain`, { method: "POST" }),

  forceVerifyInstituteCustomDomain: (id: string) =>
    apiRequest(`/v2/tenant/institutes/${id}/force-verify-domain`, { method: "POST" }),

  checkSubdomainAvailability: (subdomain: string) =>
    apiRequest(`/v2/tenant/subdomain/check/${subdomain}`),

  getInstituteBillingConfig: (id: string) =>
    apiRequest(`/v2/tenant/institutes/${id}/billing-config`),

  updateInstituteBillingConfig: (id: string, data: any) =>
    apiRequest(`/v2/tenant/institutes/${id}/billing-config`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getInstituteLoginStats: (id: string, year: number, month: number) =>
    apiRequest(`/v2/tenant/institutes/${id}/login-stats?year=${year}&month=${month}`),

  getInstitutePlanInfo: (id: string) =>
    apiRequest(`/v2/tenant/institutes/${id}/plan-info`),

  getInstituteBillingSummary: (id: string, year: number, month: number) =>
    apiRequest(`/v2/tenant/institutes/${id}/billing-summary?year=${year}&month=${month}`),

  getBillingOverview: (year: number, month: number) =>
    apiRequest(`/v2/tenant/billing-overview?year=${year}&month=${month}`),

  // Subjects
  getSubjects: (params: {
    page?: number;
    limit?: number;
    instituteId?: string;
    search?: string;
    category?: string;
    subjectType?: string;
    basketCategory?: string;
    isActive?: boolean;
    classId?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append('page', String(params.page));
    if (params.limit) q.append('limit', String(params.limit));
    if (params.instituteId) q.append('instituteId', params.instituteId);
    if (params.search) q.append('search', params.search);
    if (params.category) q.append('category', params.category);
    if (params.subjectType) q.append('subjectType', params.subjectType);
    if (params.basketCategory) q.append('basketCategory', params.basketCategory);
    if (params.isActive !== undefined) q.append('isActive', String(params.isActive));
    if (params.classId) q.append('classId', params.classId);
    return apiRequest(`/subjects?${q.toString()}`);
  },

  createSubject: (data: any) =>
    apiRequest("/subjects", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // System Payments
  getPayments: (page = 1, limit = 10) =>
    apiRequest(`/payment?page=${page}&limit=${limit}`),

  verifyPayment: (paymentId: string, data: {
    status: string;
    subscriptionPlan: string;
    paymentValidityDays: number;
    notes: string;
  }) =>
    apiRequest(`/payment/${paymentId}/verify`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // SMS Payments
  getSMSPayments: (page = 1, limit = 10) =>
    apiRequest(`/sms/admin/verifications/pending?page=${page}&limit=${limit}`),

  verifySMSPayment: (submissionId: string, data: {
    action: string;
    creditsToGrant: number;
    adminNotes: string;
  }) =>
    apiRequest(`/sms/admin/verifications/${submissionId}/verify`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // SMS Approvals
  getSMSApprovals: (page = 1, limit = 10) =>
    apiRequest(`/sms/admin/pending-approvals?page=${page}&limit=${limit}`),

  approveSMSCampaign: (messageId: string, data: { adminNotes: string }) =>
    apiRequest(`/sms/admin/campaigns/${messageId}/approve`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  rejectSMSCampaign: (messageId: string, data: { rejectionReason: string; adminNotes: string }) =>
    apiRequest(`/sms/admin/campaigns/${messageId}/reject`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // File Upload
  getSignedUrl: (folder: string, fileName: string, contentType: string, fileSize: number) =>
    apiRequest(`/upload/get-signed-url?folder=${encodeURIComponent(folder)}&fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(contentType)}&fileSize=${fileSize}`, {
      method: "GET",
    }),

  verifyAndPublish: (relativePath: string) =>
    apiRequest("/upload/verify-and-publish", {
      method: "POST",
      body: JSON.stringify({ relativePath }),
    }),

  // Institute Users
  assignUserToInstitute: (instituteId: string, data: {
    userId: string;
    instituteUserType: string;
    userIdByInstitute: string;
    instituteCardId?: string;
    instituteImage?: string;
  }) =>
    apiRequest(`/institute-users/institute/${instituteId}/assign-user-by-id`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // User RFID
  registerRfid: (userId: string, userRfid: string) =>
    apiRequest("/users/register-rfid", {
      method: "POST",
      body: JSON.stringify({ userId, userRfid }),
    }),

  // User Activate/Deactivate
  deactivateUser: (userId: string) =>
    apiRequest(`/users/${userId}/deactivate`, {
      method: "PATCH",
    }),

  activateUser: (userId: string) =>
    apiRequest(`/users/${userId}/activate`, {
      method: "PATCH",
    }),

  // User Type Change (Super Admin)
  updateUserType: (userId: string, userType: string) =>
    apiRequest(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ userType }),
    }),

  // SMS Sender Masks
  createSenderMask: (data: {
    instituteId: string;
    maskId: string;
    displayName: string;
    phoneNumber: string;
    isActive: boolean;
  }) =>
    apiRequest("/sms/sender-masks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSenderMasks: (instituteId: string) =>
    apiRequest(`/sms/sender-masks/institute/${instituteId}`),

  // Advertisements
  getAdvertisements: (page = 1, limit = 10) =>
    apiRequest(`/api/advertisements?page=${page}&limit=${limit}`),

  createAdvertisement: (data: any) =>
    apiRequest("/api/advertisements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Organizations
  getOrganizations: (params: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", String(params.page));
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.search) queryParams.append("search", params.search);
    if (params.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);
    return apiRequest(`/organizations?${queryParams.toString()}`);
  },

  getOrganizationById: (id: string) =>
    apiRequest(`/organizations/${id}`),

  createOrganization: (data: {
    name: string;
    type: string;
    isPublic?: boolean;
    enrollmentKey?: string;
    needEnrollmentVerification?: boolean;
    enabledEnrollments?: boolean;
    imageUrl?: string;
    instituteId?: string;
  }) =>
    apiRequest("/organizations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOrganization: (id: string, data: {
    name?: string;
    isPublic?: boolean;
    enrollmentKey?: string;
    needEnrollmentVerification?: boolean;
    enabledEnrollments?: boolean;
    imageUrl?: string;
    instituteId?: string;
  }) =>
    apiRequest(`/organizations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteOrganization: (id: string) =>
    apiRequest(`/organizations/${id}`, {
      method: "DELETE",
    }),

  // Organization Members
  getOrganizationMembers: (id: string, page = 1, limit = 50) =>
    apiRequest(`/organizations/${id}/members?page=${page}&limit=${limit}`),

  getUnverifiedMembers: (id: string) =>
    apiRequest(`/organizations/${id}/unverified-members`),

  verifyMember: (id: string, userId: string) =>
    apiRequest(`/organizations/${id}/verify`, {
      method: "PUT",
      body: JSON.stringify({ userId }),
    }),

  // Organization Management
  assignRole: (id: string, data: { userId: string; role: string }) =>
    apiRequest(`/organizations/${id}/assign-role`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  changeRole: (id: string, data: { userId: string; newRole: string }) =>
    apiRequest(`/organizations/${id}/change-role`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  removeUserFromOrganization: (id: string, userId: string) =>
    apiRequest(`/organizations/${id}/remove-user`, {
      method: "DELETE",
      body: JSON.stringify({ userId }),
    }),

  transferPresidency: (id: string, newPresidentUserId: string) =>
    apiRequest(`/organizations/${id}/transfer-presidency`, {
      method: "POST",
      body: JSON.stringify({ newPresidentUserId }),
    }),

  // Enrollment
  enrollInOrganization: (data: { organizationId: string; enrollmentKey?: string }) =>
    apiRequest("/organizations/enroll", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  leaveOrganization: (id: string) =>
    apiRequest(`/organizations/${id}/leave`, {
      method: "DELETE",
    }),

  getUserEnrolledOrganizations: (page = 1, limit = 10) =>
    apiRequest(`/organizations/user/enrolled?page=${page}&limit=${limit}`),

  getUserNotEnrolledOrganizations: (page = 1, limit = 10) =>
    apiRequest(`/organizations/user/not-enrolled?page=${page}&limit=${limit}`),

  // Institute Operations for Organizations
  assignInstituteToOrganization: (id: string, instituteId: string) =>
    apiRequest(`/organizations/${id}/assign-institute`, {
      method: "PUT",
      body: JSON.stringify({ instituteId }),
    }),

  removeInstituteFromOrganization: (id: string) =>
    apiRequest(`/organizations/${id}/remove-institute`, {
      method: "DELETE",
    }),

  getOrganizationsByInstitute: (instituteId: string, page = 1, limit = 10) =>
    apiRequest(`/organizations/institute/${instituteId}?page=${page}&limit=${limit}`),

  getAvailableInstitutesForOrg: () =>
    apiRequest("/organizations/available-institutes"),

  // Institute Update
  updateInstitute: (id: string, data: any) =>
    apiRequest(`/institutes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Subject Update
  updateSubject: (id: string, data: any) =>
    apiRequest(`/subjects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Structured Lectures
  getStructuredLectures: (params: {
    page?: number;
    limit?: number;
    instituteId?: string;
    classId?: number;
    subjectId?: string;
    grade?: number;
    isActive?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", String(params.page));
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.instituteId) queryParams.append("instituteId", params.instituteId);
    if (params.classId) queryParams.append("classId", String(params.classId));
    if (params.subjectId) queryParams.append("subjectId", params.subjectId);
    if (params.grade) queryParams.append("grade", String(params.grade));
    if (params.isActive !== undefined) queryParams.append("isActive", String(params.isActive));
    if (params.search) queryParams.append("search", params.search);
    if (params.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);
    return apiRequest(`/api/structured-lectures?${queryParams.toString()}`);
  },

  getStructuredLectureById: (id: string) =>
    apiRequest(`/api/structured-lectures/${id}`),

  createStructuredLecture: (data: any) =>
    apiRequest("/api/structured-lectures", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStructuredLecture: (id: string, data: any) =>
    apiRequest(`/api/structured-lectures/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  softDeleteStructuredLecture: (id: string) =>
    apiRequest(`/api/structured-lectures/${id}`, {
      method: "DELETE",
    }),

  permanentDeleteStructuredLecture: (id: string) =>
    apiRequest(`/api/structured-lectures/${id}/permanent`, {
      method: "DELETE",
    }),

  getStructuredLectureStatistics: (subjectId: string, grade?: number) => {
    const params = grade ? `?grade=${grade}` : '';
    return apiRequest(`/api/structured-lectures/statistics/${subjectId}${params}`);
  },

  getLectureSignedUrl: (fileName: string, fileType: string) =>
    apiRequest("/api/structured-lectures/upload/cover-image/signed-url", {
      method: "POST",
      body: JSON.stringify({ fileName, fileType }),
    }),

  // =============== CARD MANAGEMENT ===============

  // Admin Cards CRUD
  getAdminCards: (params: {
    page?: number;
    limit?: number;
    cardType?: string;
    isActive?: boolean;
    search?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", String(params.page));
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.cardType) queryParams.append("cardType", params.cardType);
    if (params.isActive !== undefined) queryParams.append("isActive", String(params.isActive));
    if (params.search) queryParams.append("search", params.search);
    return apiRequest(`/admin/cards?${queryParams.toString()}`);
  },

  createCard: (data: {
    cardName: string;
    cardType: string;
    cardImageUrl?: string;
    cardVideoUrl?: string;
    description?: string;
    price: number;
    quantityAvailable: number;
    validityDays: number;
  }) =>
    apiRequest("/admin/cards", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCard: (id: number, data: {
    cardName?: string;
    price?: number;
    quantityAvailable?: number;
    cardImageUrl?: string;
    cardVideoUrl?: string;
    description?: string;
    validityDays?: number;
    isActive?: boolean;
  }) =>
    apiRequest(`/admin/cards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteCard: (id: number) =>
    apiRequest(`/admin/cards/${id}`, {
      method: "DELETE",
    }),

  // Admin Card Orders
  getAdminCardOrders: (params: {
    page?: number;
    limit?: number;
    orderStatus?: string;
    cardStatus?: string;
    cardType?: string;
    userId?: number;
    cardId?: number;
    startDate?: string;
    endDate?: string;
    hasRfid?: boolean;
    search?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", String(params.page));
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.orderStatus) queryParams.append("orderStatus", params.orderStatus);
    if (params.cardStatus) queryParams.append("cardStatus", params.cardStatus);
    if (params.cardType) queryParams.append("cardType", params.cardType);
    if (params.userId) queryParams.append("userId", String(params.userId));
    if (params.cardId) queryParams.append("cardId", String(params.cardId));
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);
    if (params.hasRfid !== undefined) queryParams.append("hasRfid", String(params.hasRfid));
    if (params.search) queryParams.append("search", params.search);
    return apiRequest(`/admin/card-orders?${queryParams.toString()}`);
  },

  updateOrderStatus: (orderId: number, data: {
    orderStatus: string;
    trackingNumber?: string;
    rejectedReason?: string;
    notes?: string;
  }) =>
    apiRequest(`/admin/card-orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  assignOrderRfid: (orderId: number, rfidNumber: string) =>
    apiRequest(`/admin/card-orders/${orderId}/rfid`, {
      method: "PATCH",
      body: JSON.stringify({ rfidNumber }),
    }),

  updateCardStatus: (orderId: number, data: {
    status: string;
    notes?: string;
  }) =>
    apiRequest(`/admin/card-orders/${orderId}/card-status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getOrderStatistics: () =>
    apiRequest("/admin/card-orders/statistics"),

  // Admin Card Payments
  getAdminCardPayments: (params: {
    page?: number;
    limit?: number;
    paymentStatus?: string;
    paymentType?: string;
    orderId?: number;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", String(params.page));
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.paymentStatus) queryParams.append("paymentStatus", params.paymentStatus);
    if (params.paymentType) queryParams.append("paymentType", params.paymentType);
    if (params.orderId) queryParams.append("orderId", String(params.orderId));
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);
    return apiRequest(`/admin/card-payments?${queryParams.toString()}`);
  },

  verifyCardPayment: (paymentId: number, data: {
    paymentStatus: string;
    rejectionReason?: string;
    notes?: string;
  }) =>
    apiRequest(`/admin/card-payments/${paymentId}/verify`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // =============== PUSH NOTIFICATIONS ===============

  // ===== Admin APIs - Create & Manage =====
  
  // Create Push Notification
  createPushNotification: (data: {
    title: string;
    body: string;
    imageUrl?: string;
    icon?: string;
    actionUrl?: string;
    dataPayload?: Record<string, string>;
    scope: 'GLOBAL' | 'INSTITUTE' | 'CLASS' | 'SUBJECT';
    targetUserTypes: (
      | 'ALL' 
      | 'STUDENTS' 
      | 'TEACHERS' 
      | 'PARENTS' 
      | 'ATTENDANCE_MARKERS' 
      | 'INSTITUTE_ADMINS'
      | 'USERS_WITHOUT_INSTITUTE'
      | 'USERS_WITHOUT_PARENT'
      | 'USERS_WITHOUT_STUDENT'
      | 'VERIFIED_USERS_ONLY'
      | 'UNVERIFIED_USERS_ONLY'
    )[];
    instituteId?: string;
    classId?: string;
    subjectId?: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH';
    collapseKey?: string;
    timeToLive?: number;
    scheduledAt?: string;
    sendImmediately?: boolean;
  }) =>
    apiRequest("/push-notifications/admin", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Get All Notifications (Admin View)
  getAdminNotifications: (params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    scope?: 'GLOBAL' | 'INSTITUTE' | 'CLASS' | 'SUBJECT';
    status?: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
    instituteId?: string;
    classId?: string;
    subjectId?: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH';
    senderId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", String(params.page));
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);
    if (params.scope) queryParams.append("scope", params.scope);
    if (params.status) queryParams.append("status", params.status);
    if (params.instituteId) queryParams.append("instituteId", params.instituteId);
    if (params.classId) queryParams.append("classId", params.classId);
    if (params.subjectId) queryParams.append("subjectId", params.subjectId);
    if (params.priority) queryParams.append("priority", params.priority);
    if (params.senderId) queryParams.append("senderId", params.senderId);
    if (params.search) queryParams.append("search", params.search);
    if (params.dateFrom) queryParams.append("dateFrom", params.dateFrom);
    if (params.dateTo) queryParams.append("dateTo", params.dateTo);
    return apiRequest(`/push-notifications/admin?${queryParams.toString()}`);
  },

  // Get Single Notification (Admin)
  getAdminNotificationById: (id: string) =>
    apiRequest(`/push-notifications/admin/${id}`),

  // Send Notification
  sendPushNotification: (id: string) =>
    apiRequest(`/push-notifications/admin/${id}/send`, {
      method: "POST",
    }),

  // Resend Failed Notification
  resendPushNotification: (id: string) =>
    apiRequest(`/push-notifications/admin/${id}/resend`, {
      method: "POST",
    }),

  // Cancel Notification
  cancelPushNotification: (id: string) =>
    apiRequest(`/push-notifications/admin/${id}/cancel`, {
      method: "PUT",
    }),

  // Delete Notification
  deletePushNotification: (id: string) =>
    apiRequest(`/push-notifications/admin/${id}`, {
      method: "DELETE",
    }),

  // ===== User APIs - View & Read =====

  // Get Institute Notifications
  getInstituteNotifications: (instituteId: string, params: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    priority?: 'LOW' | 'NORMAL' | 'HIGH';
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", String(params.page));
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.unreadOnly) queryParams.append("unreadOnly", String(params.unreadOnly));
    if (params.priority) queryParams.append("priority", params.priority);
    return apiRequest(`/push-notifications/institute/${instituteId}?${queryParams.toString()}`);
  },

  // Get System/Global Notifications
  getSystemNotifications: (params: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    priority?: 'LOW' | 'NORMAL' | 'HIGH';
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", String(params.page));
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.unreadOnly) queryParams.append("unreadOnly", String(params.unreadOnly));
    if (params.priority) queryParams.append("priority", params.priority);
    return apiRequest(`/push-notifications/system?${queryParams.toString()}`);
  },

  // Get Unread Count - Institute
  getInstituteUnreadCount: (instituteId: string) =>
    apiRequest(`/push-notifications/institute/${instituteId}/unread-count`),

  // Get Unread Count - System
  getSystemUnreadCount: () =>
    apiRequest(`/push-notifications/system/unread-count`),

  // Mark Notification as Read
  markNotificationAsRead: (id: string) =>
    apiRequest(`/push-notifications/${id}/read`, {
      method: "POST",
    }),

  // Mark Multiple Notifications as Read
  markMultipleNotificationsAsRead: (notificationIds: string[]) =>
    apiRequest(`/push-notifications/mark-read`, {
      method: "POST",
      body: JSON.stringify({ notificationIds }),
    }),

  // Mark All Institute Notifications as Read
  markAllInstituteNotificationsAsRead: (instituteId: string) =>
    apiRequest(`/push-notifications/institute/${instituteId}/mark-all-read`, {
      method: "POST",
    }),

  // ===== FCM Token Management =====

  // Register FCM Token
  registerFcmToken: (data: {
    token: string;
    deviceType: 'WEB' | 'ANDROID' | 'IOS';
    deviceInfo?: string;
  }) =>
    apiRequest("/users/fcm-tokens", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Get User's FCM Tokens
  getUserFcmTokens: (userId: string) =>
    apiRequest(`/users/fcm-tokens/user/${userId}`),

  // Delete FCM Token
  deleteFcmToken: (tokenId: string) =>
    apiRequest(`/users/fcm-tokens/${tokenId}`, {
      method: "DELETE",
    }),

  // ===== Classes & Subjects for Notification Targeting =====
  
  // Get Classes by Institute
  getClassesByInstitute: (instituteId: string) =>
    apiRequest(`/institute-classes/institute/${instituteId}`),

  // Get Subjects by Class (requires both instituteId and classId)
  getSubjectsByClass: (classId: string, instituteId?: string) =>
    apiRequest(
      instituteId
        ? `/institutes/${instituteId}/classes/${classId}/subjects`
        : `/subjects?classId=${classId}&limit=100`
    ),

  // =============== PROFILE IMAGE MANAGEMENT ===============

  // Lookup Student User by Student ID
  lookupStudentUser: (studentId: string) =>
    apiRequest(`/admin/users/student/lookup/${studentId}`),

  // Generate Signed URL for Student Profile Image Upload
  generateStudentProfileImageUrl: (data: {
    studentId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
  }) =>
    apiRequest("/admin/users/student/profile-image/generate-url", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Assign Profile Image to Student User
  assignStudentProfileImage: (data: {
    studentId: string;
    relativePath: string;
  }) =>
    apiRequest("/admin/users/student/profile-image/assign", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lookup User by User ID
  lookupUser: (userId: string) =>
    apiRequest(`/admin/users/lookup/${userId}`),

  // Generate Signed URL for User Profile Image Upload
  generateUserProfileImageUrl: (data: {
    userId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
  }) =>
    apiRequest("/admin/users/profile-image/generate-url", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Assign Profile Image to User
  assignUserProfileImage: (data: {
    userId: string;
    relativePath: string;
  }) =>
    apiRequest("/admin/users/profile-image/assign", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // =============== AUTH & SESSION MANAGEMENT ===============

  // Get current user profile
  getCurrentUser: () =>
    apiRequest("/auth/me"),

  // Forgot password - send OTP
  forgotPassword: (identifier: string) =>
    apiRequest("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    }),

  // Reset password with OTP
  resetPassword: (data: {
    identifier: string;
    otp: string;
    newPassword: string;
    confirmPassword: string;
  }) =>
    apiRequest("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Change password (authenticated)
  changePasswordAuthenticated: (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) =>
    apiRequest("/auth/change-password-authenticated", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Get active sessions
  getActiveSessions: (params: {
    page?: number;
    limit?: number;
    platform?: 'web' | 'android' | 'ios';
    sortBy?: 'createdAt' | 'expiresAt' | 'platform';
    sortOrder?: 'ASC' | 'DESC';
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", String(params.page));
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.platform) queryParams.append("platform", params.platform);
    if (params.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);
    return apiRequest(`/auth/sessions?${queryParams.toString()}`);
  },

  // Revoke a specific session
  revokeSession: (sessionId: string) =>
    apiRequest(`/auth/sessions/revoke/${sessionId}`, {
      method: "POST",
    }),

  // Revoke all sessions
  revokeAllSessions: () =>
    apiRequest("/auth/sessions/revoke-all", {
      method: "POST",
    }),

  // =============== CALENDAR MANAGEMENT ===============

  // Get today's calendar day
  getCalendarToday: (instituteId: string) =>
    apiRequest(`/institutes/${instituteId}/calendar/today`),

  // Get operating config
  getOperatingConfig: (instituteId: string) =>
    apiRequest(`/institutes/${instituteId}/calendar/operating-config`),

  // Set single day operating config
  setOperatingConfig: (instituteId: string, data: {
    dayOfWeek: number;
    isOperating: boolean;
    startTime?: string;
    endTime?: string;
    academicYear: string;
  }) =>
    apiRequest(`/institutes/${instituteId}/calendar/operating-config`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Set bulk operating config
  setOperatingConfigBulk: (instituteId: string, data: {
    academicYear: string;
    configs: Array<{
      dayOfWeek: number;
      isOperating: boolean;
      startTime?: string;
      endTime?: string;
    }>;
  }) =>
    apiRequest(`/institutes/${instituteId}/calendar/operating-config/bulk`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Generate academic year calendar
  generateCalendar: (instituteId: string, data: {
    academicYear: string;
    startDate: string;
    endDate: string;
    publicHolidays?: Array<{ date: string; title: string }>;
    termBreaks?: Array<{ startDate: string; endDate: string; title: string }>;
  }) =>
    apiRequest(`/institutes/${instituteId}/calendar/generate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Delete calendar for academic year
  deleteCalendar: (instituteId: string, academicYear: string) =>
    apiRequest(`/institutes/${instituteId}/calendar/${academicYear}`, {
      method: "DELETE",
    }),

  // Get calendar days with filters
  getCalendarDays: (instituteId: string, params: {
    startDate?: string;
    endDate?: string;
    academicYear?: string;
    dayType?: string;
    limit?: number;
    page?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.startDate) q.append("startDate", params.startDate);
    if (params.endDate) q.append("endDate", params.endDate);
    if (params.academicYear) q.append("academicYear", params.academicYear);
    if (params.dayType) q.append("dayType", params.dayType);
    if (params.limit) q.append("limit", String(params.limit));
    if (params.page) q.append("page", String(params.page));
    return apiRequest(`/institutes/${instituteId}/calendar/days?${q.toString()}`);
  },

  // Update a calendar day
  updateCalendarDay: (instituteId: string, calendarDayId: string, data: {
    dayType?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    isAttendanceExpected?: boolean;
  }) =>
    apiRequest(`/institutes/${instituteId}/calendar/days/${calendarDayId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Delete a calendar day
  deleteCalendarDay: (instituteId: string, calendarDayId: string) =>
    apiRequest(`/institutes/${instituteId}/calendar/days/${calendarDayId}`, {
      method: "DELETE",
    }),

  // Get events for a calendar day
  getCalendarDayEvents: (instituteId: string, calendarDayId: string) =>
    apiRequest(`/institutes/${instituteId}/calendar/days/${calendarDayId}/events`),

  // Create calendar event
  createCalendarEvent: (instituteId: string, data: {
    calendarDayId?: string;
    calendarDate?: string;
    eventType: string;
    title: string;
    description?: string;
    eventDate: string;
    startTime?: string;
    endTime?: string;
    isAllDay?: boolean;
    isAttendanceTracked?: boolean;
    isDefault?: boolean;
    targetUserTypes?: string[];
    attendanceOpenTo?: string;
    targetScope?: string;
    targetClassIds?: string[];
    targetSubjectIds?: string[];
    venue?: string;
    status?: string;
    isMandatory?: boolean;
    maxParticipants?: number;
    notes?: string;
  }) =>
    apiRequest(`/institutes/${instituteId}/calendar/events`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // List calendar events (for event filter dropdowns)
  listCalendarEvents: (instituteId: string, params: { startDate?: string; endDate?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.startDate) q.append("startDate", params.startDate);
    if (params.endDate) q.append("endDate", params.endDate);
    q.append("limit", String(params.limit || 100));
    return apiRequest(`/institutes/${instituteId}/calendar/events?${q.toString()}`);
  },

  // Update calendar event
  updateCalendarEvent: (instituteId: string, eventId: string, data: Record<string, any>) =>
    apiRequest(`/institutes/${instituteId}/calendar/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Delete calendar event
  deleteCalendarEvent: (instituteId: string, eventId: string) =>
    apiRequest(`/institutes/${instituteId}/calendar/events/${eventId}`, {
      method: "DELETE",
    }),

  // Cache stats
  getCalendarCacheStats: (instituteId: string) =>
    apiRequest(`/institutes/${instituteId}/calendar/cache/stats`),

  // Invalidate cache
  invalidateCalendarCache: (instituteId: string) =>
    apiRequest(`/institutes/${instituteId}/calendar/cache/invalidate`, {
      method: "POST",
    }),

  // =============== ATTENDANCE DEVICE MANAGEMENT (System Admin) ===============

  // Register device
  registerDevice: (data: {
    deviceUid: string;
    deviceName: string;
    deviceType?: string;
    instituteId?: string;
    instituteName?: string;
    description?: string;
    metadata?: Record<string, any>;
  }) =>
    apiRequest("/api/admin/attendance-devices", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update device
  updateDevice: (deviceId: string, data: {
    deviceName?: string;
    deviceType?: string;
    description?: string;
    firmwareVersion?: string;
    metadata?: Record<string, any>;
  }) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Delete device
  deleteDevice: (deviceId: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}`, {
      method: "DELETE",
    }),

  // List all devices
  getDevices: (params: {
    page?: number;
    limit?: number;
    instituteId?: string;
    status?: string;
    deviceType?: string;
    isEnabled?: boolean;
    search?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.instituteId) q.append("instituteId", params.instituteId);
    if (params.status) q.append("status", params.status);
    if (params.deviceType) q.append("deviceType", params.deviceType);
    if (params.isEnabled !== undefined) q.append("isEnabled", String(params.isEnabled));
    if (params.search) q.append("search", params.search);
    return apiRequest(`/api/admin/attendance-devices?${q.toString()}`);
  },

  // Get device detail
  getDeviceDetail: (deviceId: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}`),

  // Get system stats
  getDeviceStats: () =>
    apiRequest("/api/admin/attendance-devices/stats"),

  // Assign to institute
  assignDeviceToInstitute: (deviceId: string, data: {
    instituteId: string;
    instituteName?: string;
  }) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/assign`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Unassign from institute
  unassignDevice: (deviceId: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/unassign`, {
      method: "POST",
    }),

  // Change institute
  changeDeviceInstitute: (deviceId: string, data: {
    instituteId: string;
    instituteName?: string;
  }) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/change-institute`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Enable device
  enableDevice: (deviceId: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/enable`, {
      method: "POST",
    }),

  // Disable device
  disableDevice: (deviceId: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/disable`, {
      method: "POST",
    }),

  // Block device
  blockDevice: (deviceId: string, reason?: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/block`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Unblock device
  unblockDevice: (deviceId: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/unblock`, {
      method: "POST",
    }),

  // Get device config
  getDeviceConfig: (deviceId: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/config`),

  // Update device config
  updateDeviceConfig: (deviceId: string, data: {
    maxSessions?: number;
    rateLimitPerMinute?: number;
    rateLimitPerHour?: number;
    allowedStatusMode?: string;
    allowedStatusList?: string[];
    autoStatus?: string;
    requireLocation?: boolean;
    requirePhoto?: boolean;
    allowedIpRanges?: string[];
    operatingStartTime?: string;
    operatingEndTime?: string;
  }) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/config`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Bind event to device
  bindDeviceEvent: (deviceId: string, data: {
    eventId: number;
    eventName?: string;
    calendarDayId?: number;
    statusOverride?: string;
    notes?: string;
  }) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/bind-event`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Unbind event from device
  unbindDeviceEvent: (deviceId: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/unbind-event`, {
      method: "POST",
    }),

  // Get binding history
  getDeviceBindings: (deviceId: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/bindings`),

  // Get device audit log
  getDeviceAuditLog: (deviceId: string, limit = 50) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/audit?limit=${limit}`),

  // Get device active sessions
  getDeviceSessions: (deviceId: string) =>
    apiRequest(`/api/admin/attendance-devices/${deviceId}/sessions`),

  // =============== SECURITY MONITORING (SUPERADMIN) ===============

  getSecurityMetrics: () =>
    apiRequest("/api/security/metrics"),

  getSecurityReport: () =>
    apiRequest("/api/security/report"),

  getSecurityThreats: () =>
    apiRequest("/api/security/threats"),

  getSecurityEventsForIp: (ip: string) =>
    apiRequest(`/api/security/events/${encodeURIComponent(ip)}`),

  recordSecurityEvent: (data: {
    eventType: string;
    ip?: string;
    details?: string;
    severity?: string;
  }) =>
    apiRequest("/api/security/event", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSecurityStatus: () =>
    apiRequest("/api/security/status"),

  // =============== STUDENTS MANAGEMENT ===============

  getStudents: (params: {
    page?: number;
    limit?: number;
    search?: string;
    instituteId?: string;
    classId?: string;
    isActive?: boolean;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.search) q.append("search", params.search);
    if (params.instituteId) q.append("instituteId", params.instituteId);
    if (params.classId) q.append("classId", params.classId);
    if (params.isActive !== undefined) q.append("isActive", String(params.isActive));
    return apiRequest(`/students?${q.toString()}`);
  },

  getStudentStats: () =>
    apiRequest("/students/stats"),

  getStudentById: (userId: string) =>
    apiRequest(`/students/${userId}`),

  updateStudent: (userId: string, data: Record<string, any>) =>
    apiRequest(`/students/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteStudent: (userId: string) =>
    apiRequest(`/students/${userId}`, {
      method: "DELETE",
    }),

  deactivateStudent: (userId: string) =>
    apiRequest(`/students/${userId}/deactivate`, {
      method: "PATCH",
    }),

  assignParentToStudent: (studentId: string, data: { parentUserId: string; relationship?: string }) =>
    apiRequest(`/students/${studentId}/assign-parent`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  removeParentFromStudent: (studentId: string, data: { parentUserId: string }) =>
    apiRequest(`/students/${studentId}/remove-parent`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // =============== PARENTS MANAGEMENT ===============

  getParents: (params: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.search) q.append("search", params.search);
    if (params.isActive !== undefined) q.append("isActive", String(params.isActive));
    return apiRequest(`/parents?${q.toString()}`);
  },

  getParentById: (userId: string) =>
    apiRequest(`/parents/${userId}`),

  getParentWithChildren: (userId: string) =>
    apiRequest(`/parents/${userId}/children`),

  updateParent: (userId: string, data: Record<string, any>) =>
    apiRequest(`/parents/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteParent: (userId: string) =>
    apiRequest(`/parents/${userId}`, {
      method: "DELETE",
    }),

  deactivateParent: (userId: string) =>
    apiRequest(`/parents/${userId}/deactivate`, {
      method: "PATCH",
    }),

  // =============== ATTENDANCE (CORE MARKING) ===============

  markAttendance: (data: {
    studentId: string;
    instituteId: string;
    instituteName?: string;
    classId?: string;
    className?: string;
    subjectId?: string;
    subjectName?: string;
    eventId?: number;
    status: string;
    date?: string;
    notes?: string;
    advertisementId?: string;
  }) =>
    apiRequest("/api/attendance/mark", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  markBulkAttendance: (data: {
    records: Array<{
      studentId: string;
      status: string;
      notes?: string;
    }>;
    instituteId: string;
    classId?: string;
    subjectId?: string;
    eventId?: number;
    date?: string;
  }) =>
    apiRequest("/api/attendance/mark-bulk", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getStudentAttendance: (studentId: string, params: {
    startDate?: string;
    endDate?: string;
    instituteId?: string;
    classId?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.startDate) q.append("startDate", params.startDate);
    if (params.endDate) q.append("endDate", params.endDate);
    if (params.instituteId) q.append("instituteId", params.instituteId);
    if (params.classId) q.append("classId", params.classId);
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    return apiRequest(`/api/attendance/student/${studentId}?${q.toString()}`);
  },

  markAttendanceByCard: (data: {
    cardId: string;
    instituteId: string;
    eventId?: number;
    status?: string;
  }) =>
    apiRequest("/api/attendance/mark-by-card", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  markBulkAttendanceByCard: (data: {
    cardIds: string[];
    instituteId: string;
    eventId?: number;
    status?: string;
  }) =>
    apiRequest("/api/attendance/mark-bulk-by-card", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // =============== INSTITUTE CLASSES ===============

  createInstituteClass: (data: {
    instituteId: string;
    className: string;
    grade?: number;
    specialty?: string;
    academicYear?: string;
    teacherId?: string;
    maxStudents?: number;
  }) =>
    apiRequest("/institute-classes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getInstituteClasses: (params: {
    page?: number;
    limit?: number;
    instituteId?: string;
    isActive?: boolean;
    search?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.instituteId) q.append("instituteId", params.instituteId);
    if (params.isActive !== undefined) q.append("isActive", String(params.isActive));
    if (params.search) q.append("search", params.search);
    return apiRequest(`/institute-classes?${q.toString()}`);
  },

  getInstituteClassesByInstitute: (instituteId: string) =>
    apiRequest(`/institute-classes/institute/${instituteId}`),

  getInstituteClassById: (id: string) =>
    apiRequest(`/institute-classes/${id}`),

  updateInstituteClass: (id: string, data: Record<string, any>) =>
    apiRequest(`/institute-classes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  activateInstituteClass: (id: string) =>
    apiRequest(`/institute-classes/${id}/activate`, {
      method: "PATCH",
    }),

  deactivateInstituteClass: (id: string) =>
    apiRequest(`/institute-classes/${id}/deactivate`, {
      method: "PATCH",
    }),

  deleteInstituteClass: (id: string) =>
    apiRequest(`/institute-classes/${id}`, {
      method: "DELETE",
    }),

  assignTeacherToClass: (id: string, data: { teacherId: string }) =>
    apiRequest(`/institute-classes/${id}/assign-teacher`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  unassignTeacherFromClass: (id: string) =>
    apiRequest(`/institute-classes/${id}/unassign-teacher`, {
      method: "PATCH",
    }),

  enableClassEnrollment: (id: string, data?: { enrollmentKey?: string }) =>
    apiRequest(`/institute-classes/${id}/enable-enrollment`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  disableClassEnrollment: (id: string) =>
    apiRequest(`/institute-classes/${id}/disable-enrollment`, {
      method: "POST",
    }),

  getClassEnrollmentSettings: (id: string) =>
    apiRequest(`/institute-classes/${id}/enrollment-settings`),

  uploadClassImage: (id: string, data: { imageUrl: string }) =>
    apiRequest(`/institute-classes/${id}/upload-image`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // =============== CLASS SUBJECTS ===============

  addSubjectToClass: (instituteId: string, classId: string, data: {
    subjectId: string;
    teacherId?: string;
  }) =>
    apiRequest(`/institutes/${instituteId}/classes/${classId}/subjects`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  addSubjectsToClassBulk: (instituteId: string, classId: string, data: {
    subjects: Array<{ subjectId: string; teacherId?: string }>;
  }) =>
    apiRequest(`/institutes/${instituteId}/classes/${classId}/subjects/bulk`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getClassSubjects: (instituteId: string, classId: string) =>
    apiRequest(`/institutes/${instituteId}/classes/${classId}/subjects`),

  updateClassSubject: (instituteId: string, classId: string, subjectId: string, data: Record<string, any>) =>
    apiRequest(`/institutes/${instituteId}/classes/${classId}/subjects/${subjectId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteClassSubject: (instituteId: string, classId: string, subjectId: string) =>
    apiRequest(`/institutes/${instituteId}/classes/${classId}/subjects/${subjectId}`, {
      method: "DELETE",
    }),

  assignTeacherToClassSubject: (instituteId: string, classId: string, subjectId: string, data: { teacherId: string }) =>
    apiRequest(`/institutes/${instituteId}/classes/${classId}/subjects/${subjectId}/assign-teacher`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // =============== INSTITUTE SETTINGS (MISSING) ===============

  getInstituteById: (id: string) =>
    apiRequest(`/institutes/${id}`),

  getInstituteByCode: (code: string) =>
    apiRequest(`/institutes/code/${code}`),

  deleteInstitute: (id: string) =>
    apiRequest(`/institutes/${id}`, {
      method: "DELETE",
    }),

  activateInstitute: (id: string) =>
    apiRequest(`/institutes/${id}/activate`, {
      method: "PATCH",
    }),

  deactivateInstitute: (id: string) =>
    apiRequest(`/institutes/${id}/deactivate`, {
      method: "PATCH",
    }),

  getInstituteSettings: (id: string) =>
    apiRequest(`/institutes/${id}/settings`),

  updateInstituteSettings: (id: string, data: Record<string, any>) =>
    apiRequest(`/institutes/${id}/settings`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteInstituteLogo: (id: string) =>
    apiRequest(`/institutes/${id}/logo`, {
      method: "DELETE",
    }),

  deleteInstituteLoadingGif: (id: string) =>
    apiRequest(`/institutes/${id}/loading-gif`, {
      method: "DELETE",
    }),

  deleteInstituteCoverImage: (id: string) =>
    apiRequest(`/institutes/${id}/cover-image`, {
      method: "DELETE",
    }),

  addInstituteGalleryImage: (id: string, data: { imageUrl: string }) =>
    apiRequest(`/institutes/${id}/gallery`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteInstituteGalleryImage: (id: string, imageIndex: number) =>
    apiRequest(`/institutes/${id}/gallery/${imageIndex}`, {
      method: "DELETE",
    }),

  getInstituteProfile: (id: string) =>
    apiRequest(`/institutes/${id}/profile`),

  getInstituteClassesForInstitute: (instituteId: string) =>
    apiRequest(`/institutes/${instituteId}/classes`),

  // =============== INSTITUTE PAYMENTS ===============

  createInstitutePayment: (instituteId: string, data: {
    title: string;
    amount: number;
    dueDate?: string;
    description?: string;
    targetUserTypes?: string[];
    targetClassIds?: string[];
  }) =>
    apiRequest(`/institute-payments/institute/${instituteId}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getInstitutePayments: (instituteId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.status) q.append("status", params.status);
    return apiRequest(`/institute-payments/institute/${instituteId}/payments?${q.toString()}`);
  },

  getInstitutePaymentById: (instituteId: string, paymentId: string) =>
    apiRequest(`/institute-payments/institute/${instituteId}/payments/${paymentId}`),

  updateInstitutePayment: (instituteId: string, paymentId: string, data: Record<string, any>) =>
    apiRequest(`/institute-payments/institute/${instituteId}/payments/${paymentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getInstitutePaymentStats: (instituteId: string) =>
    apiRequest(`/institute-payments/institute/${instituteId}/stats`),

  // =============== INSTITUTE USERS ===============

  getInstituteUsers: (instituteId: string, userType: string, params: {
    page?: number;
    limit?: number;
    search?: string;
    gender?: string;
    minAge?: number;
    maxAge?: number;
    city?: string;
    sortBy?: string;
    sortOrder?: string;
    isActive?: boolean;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.search) q.append("search", params.search);
    if (params.gender) q.append("gender", params.gender);
    if (params.minAge) q.append("minAge", String(params.minAge));
    if (params.maxAge) q.append("maxAge", String(params.maxAge));
    if (params.city) q.append("city", params.city);
    if (params.sortBy) q.append("sortBy", params.sortBy);
    if (params.sortOrder) q.append("sortOrder", params.sortOrder);
    if (params.isActive !== undefined) q.append("isActive", String(params.isActive));
    return apiRequest(`/institute-users/institute/${instituteId}/users/${userType}?${q.toString()}`);
  },

  getInactiveInstituteUsers: (instituteId: string, params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.search) q.append("search", params.search);
    return apiRequest(`/institute-users/institute/${instituteId}/users/inactive?${q.toString()}`);
  },

  getUnverifiedInstituteUsers: (instituteId: string, userType: string, params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.search) q.append("search", params.search);
    return apiRequest(`/institute-users/institute/${instituteId}/users/${userType}/unverified?${q.toString()}`);
  },

  activateInstituteUser: (instituteId: string, userId: string) =>
    apiRequest(`/institute-users/institute/${instituteId}/users/${userId}/activate`, {
      method: "PATCH",
    }),

  deactivateInstituteUser: (instituteId: string, userId: string) =>
    apiRequest(`/institute-users/institute/${instituteId}/users/${userId}/deactivate`, {
      method: "PATCH",
    }),

  changeInstituteUserRole: (instituteId: string, userId: string, newRole: string) =>
    apiRequest(`/institute-users/institute/${instituteId}/users/${userId}/change-role`, {
      method: "PATCH",
      body: JSON.stringify({ newRole }),
    }),

  verifyInstituteUser: (instituteId: string, userId: string) =>
    apiRequest(`/institute-users/institute/${instituteId}/verify-user`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  bulkVerifyInstituteUsers: (instituteId: string, userIds: string[]) =>
    apiRequest(`/institute-users/institute/${instituteId}/verify-users`, {
      method: "POST",
      body: JSON.stringify({ userIds }),
    }),

  removeInstituteUser: (instituteId: string, userId: string) =>
    apiRequest(`/institute-users/${instituteId}/${userId}`, {
      method: "DELETE",
    }),

  setInstituteUserPassword: (instituteId: string, targetUserId: string, newPassword: string) =>
    apiRequest(`/v2/auth/institute/set-password`, {
      method: "POST",
      body: JSON.stringify({ instituteId, targetUserId, newPassword }),
    }),

  // =============== BOOKHIRE / TRANSPORT (ADMIN) ===============

  getAllBookhires: (params: {
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    return apiRequest(`/api/bookhires/admin/all?${q.toString()}`);
  },

  getAvailableBookhires: (params: {
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    return apiRequest(`/api/bookhires/available?${q.toString()}`);
  },

  getBookhireByVehicle: (vehicleNumber: string) =>
    apiRequest(`/api/bookhires/vehicle/${encodeURIComponent(vehicleNumber)}`),

  // =============== ACCOUNT DELETION (ADMIN VIEW) ===============

  requestAccountDeletion: () =>
    apiRequest("/account/delete", {
      method: "POST",
    }),

  cancelAccountDeletion: () =>
    apiRequest("/account/cancel-deletion", {
      method: "POST",
    }),

  getAccountDeletionStatus: () =>
    apiRequest("/account/deletion-status"),

  // =============== SMS (MISSING ENDPOINTS) ===============

  sendCustomSms: (data: {
    customRecipients: string[];
    messageTemplate: string;
    instituteId?: string;
  }) =>
    apiRequest(`/sms/send-custom${data.instituteId ? `?instituteId=${data.instituteId}` : ''}`, {
      method: "POST",
      body: JSON.stringify({
        customRecipients: data.customRecipients,
        messageTemplate: data.messageTemplate,
      }),
    }),

  sendBulkSms: (data: {
    message: string;
    instituteId: string;
    classId?: string;
    subjectId?: string;
    targetUserTypes?: string[];
    senderMaskId?: string;
  }) =>
    apiRequest("/sms/send-bulk", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSmsRecipientCount: (data: {
    instituteId: string;
    classId?: string;
    subjectId?: string;
    targetUserTypes?: string[];
  }) =>
    apiRequest("/sms/recipient-count", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSmsStatistics: (instituteId?: string) => {
    const q = instituteId ? `?instituteId=${instituteId}` : '';
    return apiRequest(`/sms/statistics${q}`);
  },

  getSmsCredentialsStatus: (instituteId?: string) => {
    const q = instituteId ? `?instituteId=${instituteId}` : '';
    return apiRequest(`/sms/credentials/status${q}`);
  },

  getSmsMessageHistory: (instituteId: string, params: {
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    return apiRequest(`/sms/message-history/${instituteId}?${q.toString()}`);
  },

  // =============== GLOBAL CLASS SUBJECT QUERIES ===============

  getGlobalClassSubjects: (params: {
    page?: number;
    limit?: number;
    instituteId?: string;
    teacherId?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.instituteId) q.append("instituteId", params.instituteId);
    if (params.teacherId) q.append("teacherId", params.teacherId);
    return apiRequest(`/institute-class-subjects?${q.toString()}`);
  },

  getClassSubjectStats: () =>
    apiRequest("/institute-class-subjects/stats"),

  // =============== ADVERTISEMENTS (MISSING CRUD) ===============

  getAdvertisementById: (id: string) =>
    apiRequest(`/api/advertisements/${id}`),

  getActiveAdvertisements: () =>
    apiRequest("/api/advertisements/active"),

  updateAdvertisement: (id: string, data: Record<string, any>) =>
    apiRequest(`/api/advertisements/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteAdvertisement: (id: string) =>
    apiRequest(`/api/advertisements/${id}`, {
      method: "DELETE",
    }),

  // Advertisement stats, manual send, analytics
  getAdvertisementStats: (startDate?: string, endDate?: string) => {
    const q = new URLSearchParams();
    if (startDate) q.append("startDate", startDate);
    if (endDate) q.append("endDate", endDate);
    return apiRequest(`/api/advertisements/stats?${q.toString()}`);
  },

  getAdvertisementCacheStatus: () =>
    apiRequest("/api/advertisements/cache-status"),

  getAdvertisementCurrentCache: () =>
    apiRequest("/api/advertisements/cache/current"),

  getAdvertisementDeliveryByUser: (params: {
    userId: string;
    instituteId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    q.append("userId", params.userId);
    if (params.instituteId) q.append("instituteId", params.instituteId);
    if (params.startDate) q.append("startDate", params.startDate);
    if (params.endDate) q.append("endDate", params.endDate);
    if (params.limit) q.append("limit", String(params.limit));
    return apiRequest(`/api/advertisements/delivery/by-user?${q.toString()}`);
  },

  sendAdvertisementManually: (data: {
    advertisementId: string;
    targetType: string;
    instituteIds?: string[];
    specificUserIds?: string[];
    subscriptionPlans?: string[];
    message?: string;
  }) =>
    apiRequest("/api/advertisements/send-manual", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  checkAdvertisementSending: (data: {
    advertisementId: string;
    targetType: string;
    instituteIds?: string[];
    specificUserIds?: string[];
    subscriptionPlans?: string[];
    message?: string;
  }) =>
    apiRequest("/api/advertisements/check-sending", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getManualSendAnalytics: (startDate?: string, endDate?: string) => {
    const q = new URLSearchParams();
    if (startDate) q.append("startDate", startDate);
    if (endDate) q.append("endDate", endDate);
    return apiRequest(`/api/advertisements/analytics/manual-sends?${q.toString()}`);
  },

  recordAdvertisementClick: (id: string) =>
    apiRequest(`/api/advertisements/${id}/click`, { method: "POST" }),

  recordAdvertisementImpression: (id: string) =>
    apiRequest(`/api/advertisements/${id}/impression`, { method: "POST" }),

  // =============== ATTENDANCE (ADDITIONAL QUERIES) ===============

  getAttendanceByCardId: (cardId: string) =>
    apiRequest(`/api/attendance/by-cardId/${cardId}`),

  getInstituteAttendance: (instituteId: string, params: {
    page?: number;
    limit?: number;
    date?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.date) q.append("date", params.date);
    return apiRequest(`/api/attendance/institute/${instituteId}?${q.toString()}`);
  },

  getClassAttendance: (instituteId: string, classId: string, params: {
    page?: number;
    limit?: number;
    date?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.date) q.append("date", params.date);
    return apiRequest(`/api/attendance/institute/${instituteId}/class/${classId}?${q.toString()}`);
  },

  viewAttendance: (params: {
    instituteId?: string;
    classId?: string;
    subjectId?: string;
    date?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) q.append(key, String(value));
    });
    return apiRequest(`/api/attendance/view?${q.toString()}`);
  },

  // =============== CALENDAR ATTENDANCE ===============

  getCalendarEventAttendance: (instituteId: string, eventId: string) =>
    apiRequest(`/api/attendance/calendar/institute/${instituteId}/event/${eventId}`),

  getCalendarDayAttendance: (instituteId: string, calendarDayId: string) =>
    apiRequest(`/api/attendance/calendar/institute/${instituteId}/calendar-day/${calendarDayId}`),

  // =============== SUBJECT (ADDITIONAL) ===============

  deleteSubject: (id: string) =>
    apiRequest(`/subjects/${id}`, {
      method: "DELETE",
    }),

  getSubjectStats: (id: string) =>
    apiRequest(`/subjects/${id}/stats`),

  getSubjectActiveClasses: (id: string) =>
    apiRequest(`/subjects/${id}/active-classes`),

  // =============== USER (ADDITIONAL) ===============

  getUserById: (id: string) =>
    apiRequest(`/users/${id}`),

  updateUser: (id: string, data: Record<string, any>) =>
    apiRequest(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    apiRequest(`/users/${id}`, {
      method: "DELETE",
    }),

  getUserByPhone: (phone: string) =>
    apiRequest(`/users/basic/phone/${encodeURIComponent(phone)}`),

  getUserByRfid: (rfid: string) =>
    apiRequest(`/users/basic/rfid/${encodeURIComponent(rfid)}`),

  getUserByEmail: (email: string) =>
    apiRequest(`/users/basic/email/${encodeURIComponent(email)}`),

  getUserInstitutes: (userId: string) =>
    apiRequest(`/users/${userId}/institutes`),

  getUserStatistics: () =>
    apiRequest("/users/statistics"),

  uploadProfilePhoto: (data: FormData) =>
    apiRequest("/users/profile/upload-photo", {
      method: "PATCH",
      headers: {},
      body: data,
    }),

  // =============== DRIVE ACCESS ===============

  getDriveConnectionStatus: () =>
    apiRequest("/drive-access/status"),

  connectDrive: () =>
    apiRequest("/drive-access/connect"),

  disconnectDrive: () =>
    apiRequest("/drive-access/disconnect", { method: "POST" }),

  getDriveFiles: () =>
    apiRequest("/drive-access/files"),

  // =============== HEALTH CHECK ===============

  healthCheck: () =>
    apiRequest("/health"),

  // =============== INSTITUTE SELECTION ===============

  getAvailableInstitutes: () =>
    apiRequest("/auth/institute/available"),

  getCurrentInstitute: () =>
    apiRequest("/auth/institute/current"),

  // =============== PUBLIC INSTITUTE ===============

  getPublicInstitutes: () =>
    apiRequest("/public/institutes"),

  // =============== SYSTEM PAYMENTS (ENHANCED) ===============

  getPaymentsFiltered: (params: {
    page?: number;
    limit?: number;
    status?: string;
    month?: string;
  } = {}) => {
    const q = new URLSearchParams();
    q.append('page', String(params.page || 1));
    q.append('limit', String(params.limit || 10));
    if (params.status) q.append('status', params.status);
    if (params.month) q.append('month', params.month);
    return apiRequest(`/payment?${q.toString()}`);
  },

  resetMonthlyPayments: () =>
    apiRequest("/payment/reset-monthly", { method: "POST" }),

  // =============== PACKAGE DEFINITIONS ===============

  getPackageDefinitions: () =>
    apiRequest("/package-definitions"),

  createPackageDefinition: (data: {
    subscriptionPlan: string;
    name: string;
    description?: string;
    features?: string[];
    price: number;
    validityDays?: number;
    imageUrl?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) => apiRequest("/package-definitions", { method: "POST", body: JSON.stringify(data) }),

  updatePackageDefinition: (id: string, data: {
    name?: string;
    description?: string;
    features?: string[];
    price?: number;
    validityDays?: number;
    imageUrl?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) => apiRequest(`/package-definitions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deletePackageDefinition: (id: string) =>
    apiRequest(`/package-definitions/${id}`, { method: "DELETE" }),

  // =============== INSTITUTE PAYMENT SUBMISSIONS ===============

  getInstitutePaymentSubmissions: (instituteId: string, paymentId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    paymentMethod?: string;
    studentId?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    if (params.status) q.append("status", params.status);
    if (params.paymentMethod) q.append("paymentMethod", params.paymentMethod);
    if (params.studentId) q.append("studentId", params.studentId);
    if (params.sortBy) q.append("sortBy", params.sortBy);
    if (params.sortOrder) q.append("sortOrder", params.sortOrder);
    return apiRequest(`/institute-payment-submissions/institute/${instituteId}/payment/${paymentId}/submissions?${q.toString()}`);
  },

  verifyInstitutePaymentSubmission: (submissionId: string, data: {
    status: string;
    rejectionReason?: string;
    notes?: string;
  }) =>
    apiRequest(`/institute-payment-submissions/submission/${submissionId}/verify`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  adminVerifyStudentPayment: (instituteId: string, paymentId: string, studentId: string) =>
    apiRequest(`/institute-payments/institute/${instituteId}/payment/${paymentId}/admin-verify-student/${studentId}`, {
      method: "POST",
    }),

  searchStudentForPayment: (instituteId: string, studentId: string) =>
    apiRequest(`/institute-payments/institute/${instituteId}/search-student?studentId=${studentId}`),

  deleteInstitutePayment: (instituteId: string, paymentId: string) =>
    apiRequest(`/institute-payments/institute/${instituteId}/payments/${paymentId}`, {
      method: "DELETE",
    }),

  // =============== CLASS SUBJECT PAYMENTS ===============

  getClassSubjectPayments: (instituteId: string, classId: string, subjectId: string, params: {
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    return apiRequest(`/institute-class-subject-payments/institute/${instituteId}/class/${classId}/subject/${subjectId}?${q.toString()}`);
  },

  getClassSubjectPaymentById: (paymentId: string) =>
    apiRequest(`/institute-class-subject-payments/payment/${paymentId}`),

  createClassSubjectPayment: (instituteId: string, classId: string, subjectId: string, data: {
    title: string;
    amount: number;
    dueDate?: string;
    description?: string;
  }) =>
    apiRequest(`/institute-class-subject-payments/institute/${instituteId}/class/${classId}/subject/${subjectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateClassSubjectPayment: (paymentId: string, data: Record<string, any>) =>
    apiRequest(`/institute-class-subject-payments/payment/${paymentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getClassSubjectPaymentSubmissions: (paymentId: string, params: {
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    return apiRequest(`/institute-class-subject-payment-submissions/payment/${paymentId}/submissions?${q.toString()}`);
  },

  verifyClassSubjectPaymentSubmission: (submissionId: string, data: {
    status: string;
    rejectionReason?: string;
    notes?: string;
  }) =>
    apiRequest(`/institute-class-subject-payment-submissions/submission/${submissionId}/verify`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // =============== ATTENDANCE REPORTING ===============

  getAttendanceDailyCount: (instituteId: string, params: {
    year?: number;
    month?: number;
    eventId?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.year) q.append("year", String(params.year));
    if (params.month) q.append("month", String(params.month));
    if (params.eventId) q.append("eventId", params.eventId);
    return apiRequest(`/api/attendance/institute/${instituteId}/daily-count?${q.toString()}`);
  },

  getAttendanceClassDailyCount: (instituteId: string, classId: string, params: {
    year?: number;
    month?: number;
    eventId?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.year) q.append("year", String(params.year));
    if (params.month) q.append("month", String(params.month));
    if (params.eventId) q.append("eventId", params.eventId);
    return apiRequest(`/api/attendance/institute/${instituteId}/class/${classId}/daily-count?${q.toString()}`);
  },

  getAttendanceMonthlyCount: (instituteId: string, params: {
    year?: number;
    month?: number;
    eventId?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.year) q.append("year", String(params.year));
    if (params.month) q.append("month", String(params.month));
    if (params.eventId) q.append("eventId", params.eventId);
    return apiRequest(`/api/attendance/institute/${instituteId}/monthly-count?${q.toString()}`);
  },

  getAttendanceClassMonthlyCount: (instituteId: string, classId: string, params: {
    year?: number;
    month?: number;
    eventId?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.year) q.append("year", String(params.year));
    if (params.month) q.append("month", String(params.month));
    if (params.eventId) q.append("eventId", params.eventId);
    return apiRequest(`/api/attendance/institute/${instituteId}/class/${classId}/monthly-count?${q.toString()}`);
  },

  // =============== CARD ANALYTICS ===============

  getCardAnalytics: () =>
    apiRequest("/admin/card-orders/analytics"),

  // =============== INSTITUTE CREDITS ===============

  /** Get credit balance for an institute */
  getInstituteCreditsBalance: (instituteId: string) =>
    apiRequest(`/v2/credits/balance?instituteId=${instituteId}`),

  /** Get credit transaction history for an institute */
  getInstituteCreditsTransactions: (instituteId: string, params: {
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams({ instituteId });
    if (params.type) q.set('type', params.type);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return apiRequest(`/v2/credits/transactions?${q.toString()}`);
  },

  /** Admin: adjust credits for an institute (add or deduct) */
  adjustInstituteCredits: (instituteId: string, data: { amount: number; description?: string }) =>
    apiRequest(`/v2/credits/admin/adjust/${instituteId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  /** Get all service payments across institutes (with optional filters) */
  getAllServicePayments: (params: {
    instituteId?: string;
    serviceType?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.instituteId) q.set('instituteId', params.instituteId);
    if (params.serviceType) q.set('serviceType', params.serviceType);
    if (params.status) q.set('status', params.status);
    q.set('page', String(params.page || 1));
    q.set('limit', String(params.limit || 20));
    return apiRequest(`/v2/tenant/service-payments?${q.toString()}`);
  },

  /** Verify or reject a service payment */
  verifyServicePayment: (paymentId: string, data: {
    status: 'VERIFIED' | 'REJECTED';
    grantedQuantity?: number;
    rejectionReason?: string;
    notes?: string;
  }) =>
    apiRequest(`/v2/tenant/service-payments/${paymentId}/verify`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // =============== PHYSICAL PAYMENT COLLECTION ===============

  adminVerifyStudentCspPayment: (paymentId: string, studentId: string, data: {
    amount: number;
    date: string;
    notes?: string;
    paymentTier?: 'full' | 'half' | 'quarter';
  }) =>
    apiRequest(`/institute-class-subject-payment-submissions/payment/${paymentId}/student/${studentId}/admin-verify`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getStudentsForPayment: (paymentId: string, params: { page?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", String(params.page));
    if (params.limit) q.append("limit", String(params.limit));
    return apiRequest(`/institute-class-subject-payment-submissions/payment/${paymentId}/students?${q.toString()}`);
  },

  // =============== ERROR REPORTS ===============

  getErrorReports: (params: { page?: number; limit?: number; status?: string; kind?: string } = {}) => {
    const q = new URLSearchParams();
    q.set('page', String(params.page || 1));
    q.set('limit', String(params.limit || 20));
    if (params.status) q.set('status', params.status);
    if (params.kind) q.set('kind', params.kind);
    return apiRequest(`/admin/error-reports?${q.toString()}`);
  },

  getErrorReportById: (id: string) =>
    apiRequest(`/admin/error-reports/${id}`),

  getErrorReportStatusCounts: () =>
    apiRequest('/admin/error-reports/status-counts'),

  updateErrorReportStatus: (id: string, data: { status: string; adminNote?: string }) =>
    apiRequest(`/admin/error-reports/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // ── Institute Design Approvals ────────────────────────────────────────────
  getDesignTemplates: (params?: { status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.page)   q.set('page', String(params.page));
    if (params?.limit)  q.set('limit', String(params.limit));
    return apiRequest(`/admin/design-templates?${q}`);
  },

  approveDesignTemplate: (
    id: string,
    data: {
      costPng?: number; costPdf?: number; costWhatsapp?: number; costPrint?: number;
      allowPng?: boolean; allowPdf?: boolean; allowWhatsapp?: boolean; allowPrint?: boolean;
      whatsappTtlDays?: number; adminNotes?: string;
    },
  ) =>
    apiRequest(`/admin/design-templates/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  rejectDesignTemplate: (id: string, data: { rejectionReason: string; adminNotes?: string }) =>
    apiRequest(`/admin/design-templates/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  suspendDesignTemplate: (id: string, data?: { adminNotes?: string }) =>
    apiRequest(`/admin/design-templates/${id}/suspend`, {
      method: 'PUT',
      body: JSON.stringify(data ?? {}),
    }),

  unsuspendDesignTemplate: (id: string, data?: { adminNotes?: string }) =>
    apiRequest(`/admin/design-templates/${id}/unsuspend`, {
      method: 'PUT',
      body: JSON.stringify(data ?? {}),
    }),

  getDesignGenerations: (params?: { instituteId?: string; templateId?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.instituteId) q.set('instituteId', params.instituteId);
    if (params?.templateId)  q.set('templateId',  params.templateId);
    if (params?.page)        q.set('page', String(params.page));
    if (params?.limit)       q.set('limit', String(params.limit));
    return apiRequest(`/admin/design-templates/generations?${q}`);
  },

  // ── Gateway Payment Orders (admin) ────────────────────────────────────────
  adminGetGatewayOrders: (params?: {
    instituteId?: string;
    status?: string;
    provider?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.instituteId) q.set('instituteId', params.instituteId);
    if (params?.status)      q.set('status',      params.status);
    if (params?.provider)    q.set('provider',    params.provider);
    q.set('page',  String(params?.page  ?? 1));
    q.set('limit', String(params?.limit ?? 20));
    return apiRequest(`/payment-gateway/admin/gateway-orders?${q}`);
  },

  adminGetGatewayOrder: (orderId: string) =>
    apiRequest(`/payment-gateway/admin/gateway-orders/${orderId}`),

  adminGetGatewayStats: () =>
    apiRequest(`/payment-gateway/admin/gateway-orders/stats`),

  adminManualGrantGatewayOrder: (orderId: string) =>
    apiRequest(`/payment-gateway/admin/gateway-orders/${orderId}/manual-grant`, { method: 'POST' }),

  adminCancelGatewayOrder: (orderId: string, reason?: string) =>
    apiRequest(`/payment-gateway/admin/gateway-orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Admin WhatsApp Messaging
  whatsappGetInstitutes: (search?: string, page = 1, limit = 100) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) q.append('search', search);
    return apiRequest(`/api/attendance/admin/whatsapp/institutes?${q}`);
  },

  whatsappGetInstituteUsers: (instituteId: string, search?: string, page = 1, limit = 50) => {
    const q = new URLSearchParams({ instituteId, page: String(page), limit: String(limit) });
    if (search) q.append('search', search);
    return apiRequest(`/api/attendance/admin/whatsapp/institute-users?${q}`);
  },

  whatsappGetAttendanceUsers: (instituteId: string, date: string, page = 1, limit = 200) =>
    apiRequest(
      `/api/attendance/admin/whatsapp/attendance-users?instituteId=${instituteId}&date=${date}&page=${page}&limit=${limit}`,
    ),

  whatsappSessionStatus: (phones: string[]) =>
    apiRequest('/api/attendance/admin/whatsapp/session-status', {
      method: 'POST',
      body: JSON.stringify({ phones }),
    }),

  whatsappSendBulk: (data: {
    userIds: string[];
    message: string;
    instituteId?: string;
    sessionOpen?: boolean;
  }) =>
    apiRequest('/api/attendance/admin/whatsapp/send-bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── WhatsApp Broadcast portal (filter → count → send) ──
  waBroadcastPreview: (filter: Record<string, any>) =>
    apiRequest('/api/whatsapp/broadcast/audience/preview', {
      method: 'POST',
      body: JSON.stringify({ filter }),
    }),

  waBroadcastSample: (filter: Record<string, any>) =>
    apiRequest('/api/whatsapp/broadcast/audience/sample', {
      method: 'POST',
      body: JSON.stringify({ filter }),
    }),

  waBroadcastSend: (data: {
    filter: Record<string, any>;
    message: string;
    name?: string;
    templateId?: string;
    sessionOpenOnly?: boolean;
    messageType?: 'text' | 'image' | 'video' | 'document' | 'audio' | 'interactive';
    mediaUrl?: string;
    fileName?: string;
    interactive?: any;
  }) =>
    apiRequest('/api/whatsapp/broadcast/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  waBroadcastListTemplates: () =>
    apiRequest('/api/whatsapp/broadcast/templates'),

  waBroadcastSaveTemplate: (data: {
    id?: string; name: string; description?: string; body: string;
    flowJson?: string; placeholders?: string[];
  }) =>
    apiRequest('/api/whatsapp/broadcast/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  waBroadcastDeleteTemplate: (id: string) =>
    apiRequest(`/api/whatsapp/broadcast/templates/${id}`, { method: 'DELETE' }),

  waBroadcastListCampaigns: (limit = 50) =>
    apiRequest(`/api/whatsapp/broadcast/campaigns?limit=${limit}`),

  waBroadcastGetInstitutes: (search?: string) => {
    const q = new URLSearchParams();
    if (search) q.append('search', search);
    q.append('limit', '200');
    return apiRequest(`/api/attendance/admin/whatsapp/institutes?${q}`);
  },

  // ── Smart Cards (system admin) ─────────────────────────────────────────────
  smartCardsList: (params?: {
    scope?: string; cardType?: string; status?: string; search?: string;
    instituteId?: string; classId?: string; page?: number; limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.scope)       q.set('scope', params.scope);
    if (params?.cardType)    q.set('cardType', params.cardType);
    if (params?.status)      q.set('status', params.status);
    if (params?.search)      q.set('search', params.search);
    if (params?.instituteId) q.set('instituteId', params.instituteId);
    if (params?.classId)     q.set('classId', params.classId);
    if (params?.page)        q.set('page', String(params.page));
    if (params?.limit)       q.set('limit', String(params.limit));
    return apiRequest(`/admin/smart-cards?${q}`);
  },

  smartCardCreate: (data: { cardName: string; cardId: string; cardType: string; scope: string }) =>
    apiRequest(`/admin/smart-cards`, { method: 'POST', body: JSON.stringify(data) }),

  smartCardBulkCreate: (data: {
    cardType: string; scope: string; namePrefix?: string;
    cardIds?: string[]; rangePrefix?: string; rangeStart?: number; rangeEnd?: number; pad?: number;
  }) => apiRequest(`/admin/smart-cards/bulk`, { method: 'POST', body: JSON.stringify(data) }),

  smartCardUpdate: (id: string, data: { cardName?: string; cardType?: string; status?: string }) =>
    apiRequest(`/admin/smart-cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  smartCardDelete: (id: string) =>
    apiRequest(`/admin/smart-cards/${id}`, { method: 'DELETE' }),

  smartCardAssignToInstitute: (data: { instituteId: string; cardRowIds: string[] }) =>
    apiRequest(`/admin/smart-cards/assign-to-institute`, { method: 'POST', body: JSON.stringify(data) }),

  smartCardAssignToClass: (instituteId: string, data: { classId: string; cardRowIds: string[] }) =>
    apiRequest(`/admin/smart-cards/institutes/${instituteId}/assign-to-class`, {
      method: 'POST', body: JSON.stringify(data),
    }),
};
