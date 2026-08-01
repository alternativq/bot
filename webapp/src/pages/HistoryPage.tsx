import { useEffect, useState } from 'react';
import type { Page } from '../App';
import { getPaymentHistory } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import type { PaymentHistoryItem } from '../types';
import {
  History,
  CreditCard,
  Sparkles,
  Gem,
  Star,
  Wallet,
  ArrowLeft,
} from 'lucide-react';

interface HistoryPageProps {
  navigate: (page: Page) => void;
}

const PROVIDER_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  manual: CreditCard,
  trial: Sparkles,
  crypto: Gem,
  yoomoney: Wallet,
  stars: Star,
};

export function HistoryPage({ navigate }: HistoryPageProps) {
  const { showBackButton, hideBackButton, haptic } = useTelegram();
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    showBackButton(() => navigate('home'));
    return () => hideBackButton();
  }, [navigate, showBackButton, hideBackButton]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getPaymentHistory();
        setPayments(data.payments);
      } catch {
        /* handled by empty state */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 32, width: '50%', marginBottom: 20 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 76, marginBottom: 10, borderRadius: 18 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <div style={styles.headerRow}>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => {
            haptic('light');
            navigate('home');
          }}
          style={{ width: 36, height: 36 }}
        >
          <ArrowLeft size={18} />
        </button>
        <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>История платежей</h2>
      </div>

      {payments.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 20 }}>
          <div className="icon">
            <History size={32} />
          </div>
          <div className="title">История пуста</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Здесь появятся ваши покупки после первой подписки
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {payments.map((payment, idx) => {
            const IconComp = PROVIDER_ICONS[payment.provider] || CreditCard;

            return (
              <div
                key={payment.id}
                className="card"
                style={{
                  ...styles.paymentCard,
                  animationDelay: `${idx * 0.05}s`,
                }}
              >
                <div style={styles.paymentIconWrapper}>
                  <IconComp size={20} style={{ color: 'var(--accent-primary)' }} />
                </div>

                <div style={styles.paymentInfo}>
                  <div style={styles.paymentPlan}>{payment.plan_title}</div>
                  <div style={styles.paymentMeta}>
                    <span style={{ textTransform: 'capitalize' }}>{payment.provider}</span>
                    {payment.created_at && (
                      <>
                        {' · '}
                        {new Date(payment.created_at).toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </>
                    )}
                  </div>
                </div>

                <div style={styles.paymentAmount}>
                  {payment.amount_rub > 0 ? (
                    <span className="glow-text">{payment.amount_rub} ₽</span>
                  ) : (
                    <span className="badge badge-success" style={{ padding: '3px 8px' }}>
                      Бесплатно
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  paymentCard: {
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  paymentIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  paymentInfo: {
    flex: 1,
    minWidth: 0,
  },
  paymentPlan: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 2,
  },
  paymentMeta: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 800,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
};
