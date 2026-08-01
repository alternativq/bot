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

const PROVIDER_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
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
        /* handled */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 40, width: '45%', marginBottom: 16 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 70, marginBottom: 10, borderRadius: 16 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          className="noir-icon-btn"
          onClick={() => {
            haptic('light');
            navigate('home');
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 850, color: '#ffffff' }}>История транзакций</div>
      </div>

      {payments.length === 0 ? (
        <div className="empty-state">
          <div className="icon">
            <History size={32} />
          </div>
          <div className="title">История пуста</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Здесь появятся ваши покупки после первой подписки
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {payments.map((payment) => {
            const IconComp = PROVIDER_ICONS[payment.provider] || CreditCard;

            return (
              <div key={payment.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                <div className="noir-card-icon-box" style={{ width: 40, height: 40, borderRadius: 12 }}>
                  <IconComp size={18} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginBottom: 2 }}>
                    {payment.plan_title}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
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

                <div style={{ fontSize: 15, fontWeight: 850, color: '#ffffff' }}>
                  {payment.amount_rub > 0 ? (
                    `${payment.amount_rub} ₽`
                  ) : (
                    <span className="noir-badge">Бесплатно</span>
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
