import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { getPlans, getPaymentMethods, activateTrial } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import type { Plan, PaymentMethod, DurationGroup } from '../types';
import { groupPlansByDuration } from '../types';
import {
  Sparkles,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Zap,
  Globe,
} from 'lucide-react';

interface PlansPageProps {
  navigate: (page: Page) => void;
  goToPayment: (planId: string, methodId?: string) => void;
}

const DURATION_LABELS: Record<DurationGroup, string> = {
  m1: '1 месяц',
  m3: '3 месяца',
  m12: '12 месяцев',
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
        /* handled by empty state */
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
      showToast('Пробный период успешно активирован!', 'success');
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
        <div className="skeleton" style={{ height: 32, width: '45%', marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 48, marginBottom: 20, borderRadius: 14 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 96, marginBottom: 10, borderRadius: 18 }} />
        ))}
      </div>
    );
  }

  // Payment Method Selection Screen
  if (selectedPlan) {
    return (
      <div className="page">
        <div style={styles.headerRow}>
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => {
              haptic('light');
              setSelectedPlan(null);
            }}
            style={{ width: 36, height: 36 }}
          >
            <ArrowLeft size={18} />
          </button>
          <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Способ оплаты</h2>
        </div>

        <div className="card card-accent" style={{ marginBottom: 20, marginTop: 16 }}>
          <div style={styles.selectedPlanRow}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Выбранный тариф</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedPlan.title}</span>
          </div>
          <div style={styles.selectedPlanRow}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Длительность</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{selectedPlan.duration_days} дней</span>
          </div>
          <div style={{ ...styles.selectedPlanRow, borderTop: '1px solid var(--glass-border)', paddingTop: 10, marginTop: 4 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Итого к оплате</span>
            <span className="glow-text" style={{ fontWeight: 800, fontSize: 22 }}>
              {selectedPlan.price_rub} ₽
            </span>
          </div>
        </div>

        <p className="section-title">Выберите систему оплаты</p>

        {methods.length === 0 ? (
          <div className="empty-state">
            <div className="icon">
              <CreditCard size={28} />
            </div>
            <div className="title">Нет доступных способов</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Способы оплаты временно недоступны. Напишите в поддержку.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {methods.map((method) => (
              <button
                key={method.id}
                className="card card-interactive"
                style={styles.methodCard}
                onClick={() => handleSelectMethod(selectedPlan, method)}
              >
                <div style={styles.methodIconWrapper}>
                  <CreditCard size={22} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.methodTitle}>{method.title}</div>
                  <div style={styles.methodDesc}>{method.requisite_label}</div>
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
      <h2 style={styles.pageTitle}>Тарифы VPN</h2>

      {/* Free Trial Banner */}
      {trialAvailable && trialPlan && (
        <button
          className="card card-interactive"
          style={styles.trialCard}
          onClick={handleActivateTrial}
          disabled={trialLoading}
        >
          <div
            className="glow-orb"
            style={{
              top: -30,
              right: -10,
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3), transparent 70%)',
            }}
          />
          <div style={styles.trialTopRow}>
            <span className="badge badge-success">
              <Sparkles size={12} /> БЕСПЛАТНО
            </span>
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
              1 раз на аккаунт
            </span>
          </div>

          <div style={styles.trialTitle}>{trialPlan.title}</div>
          <div style={styles.trialDesc}>
            {trialPlan.duration_days} дня тестового периода · Без привязки карты
          </div>

          {trialLoading && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
              Активация подписки...
            </div>
          )}
        </button>
      )}

      {/* Duration Group Tabs */}
      <div className="tabs">
        {(['m1', 'm3', 'm12'] as DurationGroup[]).map((d) => (
          <button
            key={d}
            className={`tab ${activeDuration === d ? 'active' : ''}`}
            onClick={() => {
              haptic('light');
              setActiveDuration(d);
            }}
          >
            {DURATION_LABELS[d]}
          </button>
        ))}
      </div>

      {/* Plan list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups[activeDuration].map((plan) => {
          const isBestValue = plan.duration_days > 90;

          return (
            <button
              key={plan.id}
              className={`card card-interactive ${isBestValue ? 'card-accent' : ''}`}
              style={styles.planCard}
              onClick={() => handleSelectPlan(plan)}
            >
              {isBestValue && (
                <div style={styles.bestValueBadge}>
                  <Zap size={12} /> ВЫГОДНО
                </div>
              )}

              <div style={styles.planRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.planDevices}>
                    <Smartphone size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span>
                      {plan.limit_ip <= 1
                        ? '1 устройство'
                        : `${plan.limit_ip} устройств${plan.limit_ip === 3 ? 'а' : 'в'}`}
                    </span>
                  </div>

                  <div style={styles.planMetaRow}>
                    <span style={styles.planMetaItem}>
                      <Globe size={13} style={{ color: 'var(--text-muted)' }} />
                      {plan.total_gb > 0 ? `${plan.total_gb} ГБ` : 'Безлимитный трафик'}
                    </span>
                    <span>·</span>
                    <span style={styles.planMetaItem}>{plan.duration_days} дней</span>
                  </div>
                </div>

                <div style={styles.planPriceContainer}>
                  <div style={styles.planPrice}>
                    <span className="glow-text" style={{ fontSize: 24, fontWeight: 800 }}>
                      {plan.price_rub}
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginLeft: 3 }}>
                      ₽
                    </span>
                  </div>
                  <span style={styles.planPriceSub}>
                    ~{Math.round(plan.price_rub / (plan.duration_days / 30))} ₽/мес
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageTitle: {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 20,
    letterSpacing: '-0.02em',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  selectedPlanRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
  },
  trialCard: {
    marginBottom: 20,
    background: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
    width: '100%',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    textAlign: 'left' as const,
  },
  trialTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative' as const,
    zIndex: 2,
  },
  trialTitle: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 4,
    position: 'relative' as const,
    zIndex: 2,
  },
  trialDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    position: 'relative' as const,
    zIndex: 2,
  },
  planCard: {
    width: '100%',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    textAlign: 'left' as const,
    position: 'relative' as const,
  },
  bestValueBadge: {
    position: 'absolute' as const,
    top: 10,
    right: 12,
    background: 'var(--accent-gradient)',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 'var(--radius-full)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    boxShadow: '0 2px 8px var(--accent-glow)',
  },
  planRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  planDevices: {
    fontSize: 16,
    fontWeight: 750,
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  planMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  planMetaItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  planPriceContainer: {
    textAlign: 'right' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
  },
  planPrice: {
    display: 'flex',
    alignItems: 'baseline',
  },
  planPriceSub: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  methodCard: {
    width: '100%',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    textAlign: 'left' as const,
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  methodIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  methodTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 2,
  },
  methodDesc: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
};
