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
        <div className="skeleton" style={{ height: 28, width: '50%', marginBottom: 20 }} />
        <div className="tabs skeleton" style={{ height: 44, marginBottom: 16 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="card skeleton" style={{ height: 80, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  // Если выбран план — показываем способы оплаты
  if (selectedPlan) {
    return (
      <div className="page">
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Способ оплаты</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
          Тариф: <strong>{selectedPlan.title}</strong> — {selectedPlan.price_rub} ₽
        </p>

        {methods.length === 0 ? (
          <div className="empty-state">
            <div className="icon">💳</div>
            <div className="title">Нет способов оплаты</div>
            <p>Способы оплаты пока не настроены администратором</p>
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
                <div style={styles.methodTitle}>{method.title}</div>
                <div style={styles.methodDesc}>{method.requisite_label}</div>
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
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Выберите тариф</h2>

      {/* Trial */}
      {trialAvailable && trialPlan && (
        <button
          className="card"
          style={styles.trialCard}
          onClick={handleActivateTrial}
          disabled={trialLoading}
        >
          <div style={styles.trialBadge}>🎁 БЕСПЛАТНО</div>
          <div style={styles.trialTitle}>{trialPlan.title}</div>
          <div style={styles.trialDesc}>
            {trialPlan.duration_days} дней · Без оплаты · Один раз
          </div>
          {trialLoading && <div style={{ marginTop: 8, fontSize: 13 }}>Активация...</div>}
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
                <span style={styles.priceAmount}>{plan.price_rub}</span>
                <span style={styles.priceCurrency}> ₽</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  trialCard: {
    marginBottom: 16,
    textAlign: 'center' as const,
    background: 'linear-gradient(135deg, rgba(0, 184, 148, 0.12), rgba(0, 184, 148, 0.04))',
    borderColor: 'rgba(0, 184, 148, 0.2)',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
  },
  trialBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    background: 'rgba(0, 184, 148, 0.2)',
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--success)',
    marginBottom: 8,
  },
  trialTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  trialDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
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
    fontWeight: 600,
    marginBottom: 2,
  },
  planDuration: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  planPrice: {
    textAlign: 'right' as const,
  },
  priceAmount: {
    fontSize: 22,
    fontWeight: 700,
    background: 'var(--gradient-accent)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  priceCurrency: {
    fontSize: 14,
    color: 'var(--text-secondary)',
  },
  methodCard: {
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    textAlign: 'left' as const,
    padding: 16,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 4,
  },
  methodDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
};
