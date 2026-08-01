import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { getPlans, getPaymentMethods, activateTrial } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import type { Plan, PaymentMethod, DurationGroup } from '../types';
import { groupPlansByDuration } from '../types';

interface PlansPageProps {
  navigate: (page: Page) => void;
  goToPayment: (planId: string, methodId?: string) => void;
}

const DURATION_LABELS: Record<DurationGroup, string> = {
  m1: '1 мес',
  m3: '3 мес',
  m12: '12 мес',
};

export function PlansPage({ navigate, goToPayment }: PlansPageProps) {
  const { haptic, showBackButton, hideBackButton } = useTelegram();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDuration, setActiveDuration] = useState<DurationGroup>('m1');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);

  useEffect(() => {
    showBackButton(() => {
      setSelectedPlan(null);
      navigate('home');
    });
    return () => hideBackButton();
  }, [navigate, showBackButton, hideBackButton]);

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
    haptic('medium');
    try {
      await activateTrial();
      navigate('subscription');
    } catch {
      /* toast error */
    } finally {
      setTrialLoading(false);
    }
  }, [haptic, navigate]);

  const handleSelectPlan = useCallback(
    (plan: Plan) => {
      haptic();
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
        <div className="skeleton" style={{ height: 32, width: '50%', marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 44, marginBottom: 20, borderRadius: 12 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 84, marginBottom: 8, borderRadius: 18 }} />
        ))}
      </div>
    );
  }

  // Method selection view
  if (selectedPlan) {
    return (
      <div className="page">
        <h2 style={styles.pageTitle}>Способ оплаты</h2>
        <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <div style={styles.selectedPlanRow}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Тариф</span>
            <span style={{ fontWeight: 700 }}>{selectedPlan.title}</span>
          </div>
          <div style={styles.selectedPlanRow}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Сумма</span>
            <span className="glow-text" style={{ fontWeight: 800, fontSize: 18 }}>
              {selectedPlan.price_rub} ₽
            </span>
          </div>
        </div>

        {methods.length === 0 ? (
          <div className="empty-state">
            <div className="icon">💳</div>
            <div className="title">Нет способов оплаты</div>
            <p>Способы оплаты пока не настроены</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {methods.map((method) => (
              <button
                key={method.id}
                className="card"
                style={styles.methodCard}
                onClick={() => handleSelectMethod(selectedPlan, method)}
              >
                <div style={styles.methodIcon}>💳</div>
                <div>
                  <div style={styles.methodTitle}>{method.title}</div>
                  <div style={styles.methodDesc}>{method.requisite_label}</div>
                </div>
                <span style={styles.methodArrow}>→</span>
              </button>
            ))}
          </div>
        )}

        <button
          className="btn btn-secondary btn-block"
          style={{ marginTop: 16 }}
          onClick={() => {
            haptic();
            setSelectedPlan(null);
          }}
        >
          ← Назад к тарифам
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 style={styles.pageTitle}>Выберите тариф</h2>

      {/* Trial */}
      {trialAvailable && trialPlan && (
        <button
          className="card"
          style={styles.trialCard}
          onClick={handleActivateTrial}
          disabled={trialLoading}
        >
          <div className="glow-orb" style={{ top: -40, right: -20, background: 'radial-gradient(circle, rgba(52, 211, 153, 0.3), transparent 70%)' }} />
          <div style={styles.trialBadge}>🎁 БЕСПЛАТНО</div>
          <div style={styles.trialTitle}>{trialPlan.title}</div>
          <div style={styles.trialDesc}>
            {trialPlan.duration_days} дней · Без оплаты · Один раз
          </div>
          {trialLoading && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--success)' }}>Активация...</div>}
        </button>
      )}

      {/* Duration tabs */}
      <div className="tabs">
        {(['m1', 'm3', 'm12'] as DurationGroup[]).map((d) => (
          <button
            key={d}
            className={`tab ${activeDuration === d ? 'active' : ''}`}
            onClick={() => {
              haptic();
              setActiveDuration(d);
            }}
          >
            {DURATION_LABELS[d]}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups[activeDuration].map((plan) => (
          <button
            key={plan.id}
            className="card"
            style={styles.planCard}
            onClick={() => handleSelectPlan(plan)}
          >
            <div style={styles.planRow}>
              <div>
                <div style={styles.planDevices}>
                  {plan.limit_ip <= 1
                    ? '1 устройство'
                    : `${plan.limit_ip} устройств${plan.limit_ip === 3 ? 'а' : ''}`}
                </div>
                <div style={styles.planDuration}>
                  {plan.duration_days} дней
                  {plan.total_gb > 0 ? ` · ${plan.total_gb} ГБ` : ' · Безлимит'}
                </div>
              </div>
              <div style={styles.planPrice}>
                <span className="glow-text" style={{ fontSize: 24, fontWeight: 800 }}>
                  {plan.price_rub}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginLeft: 2 }}>₽</span>
              </div>
            </div>
          </button>
        ))}
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
  selectedPlanRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
  },
  trialCard: {
    marginBottom: 20,
    textAlign: 'center' as const,
    background: 'rgba(52, 211, 153, 0.04)',
    borderColor: 'rgba(52, 211, 153, 0.15)',
    cursor: 'pointer',
    border: '1px solid rgba(52, 211, 153, 0.15)',
    width: '100%',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  trialBadge: {
    display: 'inline-block',
    padding: '5px 14px',
    background: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--success)',
    marginBottom: 10,
    letterSpacing: '0.05em',
    position: 'relative' as const,
    zIndex: 2,
  },
  trialTitle: {
    fontSize: 17,
    fontWeight: 700,
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
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    textAlign: 'left' as const,
  },
  planRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planDevices: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 3,
  },
  planDuration: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  planPrice: {
    textAlign: 'right' as const,
    display: 'flex',
    alignItems: 'baseline',
  },
  methodCard: {
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    textAlign: 'left' as const,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  methodIcon: {
    fontSize: 24,
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--glass-bg)',
    borderRadius: 12,
    border: '1px solid var(--glass-border)',
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
  methodArrow: {
    marginLeft: 'auto',
    color: 'var(--text-secondary)',
    fontSize: 18,
  },
};
