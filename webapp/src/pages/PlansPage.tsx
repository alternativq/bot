import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { getPlans, getPaymentMethods, activateTrial } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import logoImg from '../assets/logo.webp';
import type { Plan, PaymentMethod, DurationGroup } from '../types';
import { groupPlansByDuration } from '../types';
import {
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Zap,
  Shield,
} from 'lucide-react';

interface PlansPageProps {
  navigate: (page: Page) => void;
  goToPayment: (planId: string, methodId?: string) => void;
}

const DURATION_LABELS: Record<DurationGroup, string> = {
  m1: '1 Месяц',
  m3: '3 Месяца',
};

export function PlansPage({ navigate, goToPayment }: PlansPageProps) {
  const { haptic, showBackButton, hideBackButton } = useTelegram();
  const { showToast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDuration, setActiveDuration] = useState<DurationGroup>('m1');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);

  useEffect(() => {
    showBackButton(() => {
      if (selectedPlan) {
        setSelectedPlan(null);
      } else {
        navigate('home');
      }
    });
    return () => hideBackButton();
  }, [navigate, selectedPlan, showBackButton, hideBackButton]);

  useEffect(() => {
    async function load() {
      try {
        const [plansData, methodsData] = await Promise.all([
          getPlans(),
          getPaymentMethods(),
        ]);
        setPlans(plansData.plans);
        setTrialAvailable(plansData.trial_available);
        setMethods(methodsData.methods);
      } catch {
        /* handled */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const groups = groupPlansByDuration(plans);
  const trialPlan = plans.find((p) => p.is_trial);

  const handleActivateTrial = useCallback(async () => {
    setTrialLoading(true);
    haptic('heavy');
    try {
      await activateTrial();
      showToast('Пробный период активирован!', 'success');
      navigate('subscription');
    } catch (err: any) {
      showToast(err.message || 'Не удалось активировать триал', 'error');
    } finally {
      setTrialLoading(false);
    }
  }, [haptic, navigate, showToast]);

  const handleSelectPlan = useCallback(
    (plan: Plan) => {
      haptic('medium');
      setSelectedPlan(plan);
    },
    [haptic],
  );

  const handleSelectMethod = useCallback(
    (plan: Plan, method: PaymentMethod) => {
      haptic('medium');
      goToPayment(plan.id, method.id);
    },
    [haptic, goToPayment],
  );

  if (loading) {
    return (
      <div className="page">
        <div style={{ marginBottom: 16 }} className="skeleton" />
        <div className="noir-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 180, borderRadius: 20 }} />
          ))}
        </div>
      </div>
    );
  }

  // Payment Method Selection View
  if (selectedPlan) {
    return (
      <div className="page">
        <div className="funnel-step-header">
          <span className="funnel-step-badge">ШАГ 2 ИЗ 3</span>
          <span className="funnel-step-title">Выберите способ оплаты</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            className="noir-icon-btn"
            onClick={() => {
              haptic('light');
              setSelectedPlan(null);
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ fontSize: 18, fontWeight: 850, color: '#ffffff' }}>Способ оплаты</div>
        </div>

        <div className="card card-accent" style={{ marginBottom: 20 }}>
          <div className="info-row">
            <span className="label">Выбранный тариф</span>
            <span className="value">{selectedPlan.title}</span>
          </div>
          <div className="info-row">
            <span className="label">Длительность</span>
            <span className="value">{selectedPlan.duration_days} дней</span>
          </div>
          <div className="info-row" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 10 }}>
            <span className="label">К оплате</span>
            <span style={{ fontSize: 22, fontWeight: 850, color: '#ffffff' }}>
              {selectedPlan.price_rub} ₽
            </span>
          </div>
        </div>

        <div className="noir-section-title">ДОСТУПНЫЕ СПОСОБЫ ОПЛАТЫ</div>

        {methods.length === 0 ? (
          <div className="empty-state">
            <div className="icon">
              <CreditCard size={28} />
            </div>
            <div className="title">Нет способов оплаты</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {methods.map((method) => (
              <button
                key={method.id}
                className="card card-interactive"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}
                onClick={() => handleSelectMethod(selectedPlan, method)}
              >
                <div className="noir-card-icon-box">
                  <CreditCard size={20} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>{method.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{method.requisite_label}</div>
                </div>
                <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="funnel-step-header">
        <span className="funnel-step-badge">ШАГ 1 ИЗ 3</span>
        <span className="funnel-step-title">Выберите подходящий тариф</span>
      </div>

      {/* Noir Header */}
      <div className="noir-header">
        <div className="noir-header-left">
          <div className="noir-logo-box">
            <img src={logoImg} alt="VeiloraVPN" style={{ width: '100%', height: '100%', borderRadius: 14, objectFit: 'cover' }} />
          </div>
          <div>
            <div className="noir-header-title">КАТАЛОГ ТАРИФОВ</div>
            <div className="noir-header-sub">ОФИЦИАЛЬНЫЙ VPN · МГНОВЕННО</div>
          </div>
        </div>
      </div>

      {/* Noir Pill Filter Scroll Bar */}
      <div className="noir-pills-scroll">
        {(['m1', 'm3'] as DurationGroup[]).map((d) => {
          const isActive = activeDuration === d;
          const count = groups[d].length;

          return (
            <button
              key={d}
              className={`noir-pill ${isActive ? 'active' : ''}`}
              onClick={() => {
                haptic('light');
                setActiveDuration(d);
              }}
            >
              <Zap size={14} />
              <span>{DURATION_LABELS[d]}</span>
              <span className="noir-pill-badge">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Free Trial Banner */}
      {trialAvailable && trialPlan && (
        <div
          className="card card-interactive card-accent"
          style={{ marginBottom: 18 }}
          onClick={handleActivateTrial}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 850, color: '#ffffff' }}>
              🎁 {trialPlan.title}
            </div>
            <span className="noir-badge">БЕСПЛАТНО</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {trialPlan.duration_days} дня тестового доступа · 1 раз на аккаунт
          </div>
          <button
            className="btn btn-primary btn-block btn-sm"
            disabled={trialLoading}
          >
            {trialLoading ? 'Активация...' : 'Активировать бесплатно →'}
          </button>
        </div>
      )}

      {/* Noir Section Title */}
      <div className="noir-section-title">ТАРИФЫ ({groups[activeDuration].length})</div>

      {/* 2-Column Catalog Cards Grid matching screenshot */}
      <div className="noir-grid">
        {groups[activeDuration].map((plan) => {
          const isHit = plan.duration_days > 90;
          const oldPrice = Math.round(plan.price_rub * 1.35);

          return (
            <div
              key={plan.id}
              className="card card-interactive"
              onClick={() => handleSelectPlan(plan)}
            >
              <div className="noir-card-top">
                <div className="noir-card-icon-box">
                  <Shield size={22} />
                </div>
                {isHit && <span className="noir-badge">ХИТ</span>}
              </div>

              <div className="noir-card-title">{plan.title}</div>
              <div className="noir-card-desc">
                {plan.limit_ip} уст. · {plan.total_gb > 0 ? `${plan.total_gb} ГБ` : 'Безлимит'}
              </div>

              <div className="noir-card-price-row">
                <span className="noir-price">{plan.price_rub} ₽</span>
                {isHit && <span className="noir-price-old">{oldPrice} ₽</span>}
              </div>

              <div className="noir-card-footer">
                <span>∞ моментальная выдача</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
