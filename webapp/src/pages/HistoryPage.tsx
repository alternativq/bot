import { useEffect, useState } from 'react';
import type { Page } from '../App';
import { getPaymentHistory } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import type { PaymentHistoryItem } from '../types';

interface HistoryPageProps {
  navigate: (page: Page) => void;
}

const PROVIDER_ICONS: Record<string, string> = {
  manual: '💳',
  trial: '🎁',
  crypto: '💎',
  yoomoney: '🟣',
  stars: '⭐',
};

export function HistoryPage({ navigate }: HistoryPageProps) {
  const { showBackButton, hideBackButton } = useTelegram();
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
        <div className="skeleton" style={{ height: 32, width: '50%', marginBottom: 24 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 76, marginBottom: 8, borderRadius: 18 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <h2 style={styles.pageTitle}>История платежей</h2>

      {payments.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📜</div>
          <div className="title">Нет платежей</div>
          <p>Здесь появятся ваши платежи после первой покупки</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payments.map((payment, idx) => (
            <div
              key={payment.id}
              className="card"
              style={{
                ...styles.paymentCard,
                animationDelay: `${idx * 0.05}s`,
              }}
            >
              <div style={styles.paymentIcon}>
                {PROVIDER_ICONS[payment.provider] || '💳'}
              </div>
              <div style={styles.paymentInfo}>
                <div style={styles.paymentPlan}>{payment.plan_title}</div>
                <div style={styles.paymentMeta}>
                  {payment.provider}
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
                  <span style={{ color: 'var(--success)' }}>Бесплатно</span>
                )}
              </div>
            </div>
          ))}
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
  paymentCard: {
    padding: '16px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    animation: 'pageIn 0.3s var(--ease) both',
  },
  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
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
