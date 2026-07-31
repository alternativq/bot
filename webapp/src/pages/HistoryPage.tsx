import { useEffect, useState } from 'react';
import type { Page } from '../App';
import { getPaymentHistory } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import type { PaymentHistoryItem } from '../types';

interface HistoryPageProps {
  navigate: (page: Page) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  manual: '💳 Ручная',
  trial: '🎁 Пробный',
  crypto: '💎 CryptoBot',
  yoomoney: '💳 ЮMoney',
  stars: '⭐ Stars',
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
        <div className="skeleton" style={{ height: 28, width: '50%', marginBottom: 20 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="card skeleton" style={{ height: 72, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>История платежей</h2>

      {payments.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📜</div>
          <div className="title">Нет платежей</div>
          <p>Здесь появятся ваши платежи после первой покупки</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payments.map((payment) => (
            <div key={payment.id} className="card" style={styles.paymentCard}>
              <div style={styles.paymentRow}>
                <div>
                  <div style={styles.paymentPlan}>{payment.plan_title}</div>
                  <div style={styles.paymentMeta}>
                    {PROVIDER_LABELS[payment.provider] || payment.provider}
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
                  {payment.amount_rub > 0 ? `${payment.amount_rub} ₽` : 'Бесплатно'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  paymentCard: {
    padding: 16,
  },
  paymentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentPlan: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 2,
  },
  paymentMeta: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--accent)',
    whiteSpace: 'nowrap' as const,
  },
};
