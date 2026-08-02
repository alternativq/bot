/* ── TypeScript типы для Mini App ── */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface Plan {
  id: string;
  title: string;
  price_rub: number;
  price_usdt: number;
  duration_days: number;
  total_gb: number;
  limit_ip: number;
  is_trial: boolean;
}

export interface PaymentMethod {
  id: string;
  title: string;
  requisite_label: string;
  requisite: string;
}

export interface TrafficInfo {
  upload: number;
  download: number;
  total_bytes: number;
}

export interface SubscriptionInfo {
  plan_id: string;
  plan_title: string;
  price_rub: number;
  duration_days: number;
  limit_ip: number;
  total_gb: number;
  active: boolean;
  disabled: boolean;
  period_end: string;
  days_left: number;
  sub_link: string | null;
  public_token: string;
  traffic?: TrafficInfo;
}

export interface UserProfile {
  tg_id: number;
  username: string | null;
  is_admin?: boolean;
  trial_used: boolean;
  trial_enabled: boolean;
  created_at: string | null;
  referral_code: string;
  discount_percent: number;
  subscription: SubscriptionInfo | null;
}

export interface PurchaseResult {
  pending_id?: number;
  order_code?: string;
  plan_title: string;
  method_title?: string;
  amount_rub: number;
  discount_percent: number;
  requisite_label?: string;
  requisite?: string;
  payment_url?: string;
  status?: string;
  plan_id?: string;
}

export interface PaymentHistoryItem {
  id: number;
  provider: string;
  plan_id: string;
  plan_title: string;
  amount_rub: number;
  created_at: string | null;
}

export interface ReferralInfo {
  referral_code: string;
  referral_link: string;
}

export interface AdminUser {
  tg_id: number;
  username: string | null;
  created_at: string | null;
  subscription: {
    plan_title: string;
    active: boolean;
    disabled: boolean;
    period_end: string;
  } | null;
}

export interface InboundItem {
  id: number;
  remark: string;
  port: number;
  protocol: string;
}

export interface AdminUserDetail {
  user: {
    tg_id: number;
    username: string | null;
    created_at: string | null;
  };
  subscription: {
    plan_id: string;
    plan_title: string;
    active: boolean;
    disabled: boolean;
    period_end: string;
    xui_sub_ids: Record<string, string>;
  } | null;
  traffic: TrafficInfo;
  inbounds: InboundItem[];
}

export interface PendingPaymentAdmin {
  id: number;
  user_tg_id: number;
  username: string | null;
  plan_id: string;
  plan_title: string;
  method_id: string;
  method_title: string;
  order_code: string;
  amount_rub: number;
  created_at: string | null;
}

/* ── Группировка тарифов по длительности ── */
export type DurationGroup = 'm1' | 'm3';

export function groupPlansByDuration(plans: Plan[]): Record<DurationGroup, Plan[]> {
  const groups: Record<DurationGroup, Plan[]> = {
    m1: [],
    m3: [],
  };

  for (const plan of plans) {
    if (plan.is_trial) continue;
    if (plan.duration_days <= 31) groups.m1.push(plan);
    else groups.m3.push(plan);
  }

  return groups;
}
