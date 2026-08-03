/**
 * HTTP-клиент для Backend API.
 * Автоматически прикрепляет JWT-токен к каждому запросу.
 */
import type {
  AdminUser,
  AdminUserDetail,
  PaymentHistoryItem,
  PaymentMethod,
  PendingPaymentAdmin,
  Plan,
  PurchaseResult,
  ReferralInfo,
  SubscriptionInfo,
  UserProfile,
} from '../types';

const API_BASE = '/api/v1';

let authToken: string | null = null;

export function setAuthToken(token: string) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/* ── Auth ── */

export async function authenticate(initData: string): Promise<{ token: string; user: any }> {
  return request('/auth', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  });
}

/* ── Profile ── */

export async function getMe(): Promise<UserProfile> {
  return request('/me');
}

/* ── Plans ── */

export async function getPlans(): Promise<{ plans: Plan[]; trial_available: boolean }> {
  return request('/plans');
}

/* ── Payment Methods ── */

export async function getPaymentMethods(): Promise<{ methods: PaymentMethod[] }> {
  return request('/payment-methods');
}

/* ── Purchase ── */

export async function createPurchase(
  planId: string,
  methodId?: string,
): Promise<PurchaseResult> {
  return request('/purchase', {
    method: 'POST',
    body: JSON.stringify({ plan_id: planId, method_id: methodId }),
  });
}

export async function markPaid(pendingId: number): Promise<{ status: string }> {
  return request(`/purchase/${pendingId}/paid`, { method: 'POST' });
}

/* ── Subscription ── */

export async function getSubscription(): Promise<{ subscription: SubscriptionInfo | null }> {
  return request('/subscription');
}

export async function getSubscriptionQR(): Promise<{ qr_base64: string; sub_link: string }> {
  return request('/subscription/qr');
}

/* ── Payments History ── */

export async function getPaymentHistory(): Promise<{ payments: PaymentHistoryItem[] }> {
  return request('/payments/history');
}

/* ── Promo ── */

export async function applyPromo(code: string): Promise<{ success: boolean; message: string }> {
  return request('/promo/apply', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function getReferral(): Promise<ReferralInfo> {
  return request('/promo/referral');
}

/* ── Trial ── */

export async function activateTrial(): Promise<{ status: string }> {
  return request('/trial/activate', { method: 'POST' });
}

/* ── Admin API ── */

export async function adminSearchUsers(q: string): Promise<{ users: AdminUser[] }> {
  return request(`/admin/users/search?q=${encodeURIComponent(q)}`);
}

export async function adminGetUser(targetTgId: number): Promise<AdminUserDetail> {
  return request(`/admin/user/${targetTgId}`);
}

export async function adminExtendUser(targetTgId: number, days: number): Promise<{ status: string; period_end: string }> {
  return request(`/admin/user/${targetTgId}/extend`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  });
}

export async function adminToggleUser(targetTgId: number): Promise<{ disabled: boolean }> {
  return request(`/admin/user/${targetTgId}/toggle`, { method: 'POST' });
}

export async function adminAddInbound(targetTgId: number, inboundId: number): Promise<{ status: string }> {
  return request(`/admin/user/${targetTgId}/add-inbound`, {
    method: 'POST',
    body: JSON.stringify({ inbound_id: inboundId }),
  });
}

export async function adminGetPendingPayments(): Promise<{ pending: PendingPaymentAdmin[] }> {
  return request('/admin/pending-payments');
}

export async function adminResolvePayment(pendingId: number, action: 'confirm' | 'reject'): Promise<{ status: string }> {
  return request(`/admin/pending-payments/${pendingId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export async function adminDeleteSubscription(targetTgId: number): Promise<{ status: string }> {
  return request(`/admin/user/${targetTgId}/delete-sub`, { method: 'POST' });
}

export async function adminGrantTrial(targetTgId: number): Promise<{ status: string; period_end: string }> {
  return request(`/admin/user/${targetTgId}/grant-trial`, { method: 'POST' });
}

export async function adminDeleteUserCompletely(targetTgId: number): Promise<{ status: string }> {
  return request(`/admin/user/${targetTgId}/delete-user`, { method: 'POST' });
}

export interface AdminPromoCode {
  id: number;
  code: string;
  discount_percent: number;
  bonus_days: number;
  uses_left: number | null;
  is_active: boolean;
  created_at: string | null;
  uses_count: number;
}

export async function adminGetPromos(): Promise<{ promos: AdminPromoCode[] }> {
  return request('/admin/promos');
}

export async function adminCreatePromo(data: {
  code: string;
  discount_percent: number;
  bonus_days: number;
  uses_left?: number | null;
}): Promise<{ status: string; promo: AdminPromoCode }> {
  return request('/admin/promos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function adminDeletePromo(promoId: number): Promise<{ status: string }> {
  return request(`/admin/promos/${promoId}`, { method: 'DELETE' });
}

export interface AdminStats {
  total_users: number;
  active_subs: number;
  expiring_3days: number;
  revenue_today: number;
  revenue_month: number;
  total_revenue: number;
}

export async function adminGetStats(): Promise<AdminStats> {
  return request('/admin/stats');
}

export async function adminBroadcast(message: string): Promise<{
  status: string;
  sent_count: number;
  failed_count: number;
  total: number;
}> {
  return request('/admin/broadcast', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
