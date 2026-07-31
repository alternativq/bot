import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { createPurchase, markPaid } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import type { PurchaseResult } from '../types';

interface PaymentPageProps {
  navigate: (page: Page) => void;
  planId: string;
  methodId?: string;
}

export function PaymentPage({ navigate, planId, methodId }: PaymentPageProps) {
  const { tg, haptic, showBackButton, hideBackButton } = useTelegram();
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    showBackButton(() => navigate('plans'));
    return () => hideBackButton();
  }, [navigate, showBackButton, hideBackButton]);

  useEffect(() => {
    async function init() {
      try {
        const data = await createPurchase(planId, methodId);
        setResult(data);

        // Для trial — сразу переходим
        if (data.status === 'activated') {
          navigate('subscription');
          return;
        }
      } catch (err: any) {
        setError(err.message || 'Ошибка создания заказа');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [planId, methodId, navigate]);

  const handleOpenPayment = useCallback(() => {
    if (!result?.payment_url) return;
    haptic('medium');
    tg?.openLink(result.payment_url);
  }, [result, haptic, tg]);

  const handleMarkPaid = useCallback(async () => {
    if (!result?.pending_id) return;
    haptic('medium');
    setNotifying(true);
    try {
      await markPaid(result.pending_id);
      setNotified(true);
    } catch {
      /* error */
    } finally {
      setNotifying(false);
    }
  }, [result, haptic]);

  const copyRequisite = useCallback(async () => {
    if (!result?.requisite) return;
    try {
      await navigator.clipboard.writeText(result.requisite);
      haptic();
    } catch {
      /* clipboard not available */
    }
  }, [result, haptic]);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 28, width: '60%', marginBottom: 20 }} />
        <div className="card skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="icon">⚠️</div>
          <div className="title">Ошибка</div>
          <p>{error}</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => navigate('plans')}
          >
            Назад к тарифам
          </button>
        </div>
      </div>
    );
  }

  if (notified) {
    return (
      <div className="page">
        <div style={styles.successContainer}>
          <div style={styles.successIcon}>✅</div>
          <h2 style={styles.successTitle}>Заявка отправлена!</h2>
          <p style={styles.successText}>
            Администратор получил уведомление. После подтверждения оплаты
            ключ и инструкция придут автоматически в бот.
          </p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 24 }}
            onClick={() => navigate('home')}
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="page">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Оплата</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="info-row">
          <span className="label">Тариф</span>
          <span className="value">{result.plan_title}</span>
        </div>
        <div className="info-row">
          <span className="label">Сумма</span>
          <span className="value" style={{ color: 'var(--accent)' }}>
            {result.amount_rub} ₽
            {result.discount_percent > 0 && (
              <span style={{ fontSize: 12, color: 'var(--success)', marginLeft: 4 }}>
                -{result.discount_percent}%
              </span>
            )}
          </span>
        </div>
        {result.order_code && (
          <div className="info-row">
            <span className="label">Код заказа</span>
            <span className="value" style={{ color: 'var(--warning)', fontFamily: 'monospace' }}>
              {result.order_code}
            </span>
          </div>
        )}
      </div>

      {/* Ссылка на оплату (ЮMoney, CryptoBot) */}
      {result.payment_url && (
        <button
          className="btn btn-primary btn-block"
          style={{ marginBottom: 12 }}
          onClick={handleOpenPayment}
        >
          💳 Перейти к оплате
        </button>
      )}

      {/* Реквизиты для ручного перевода */}
      {result.requisite && !result.payment_url && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="section-title">{result.requisite_label}</p>
          <div className="copy-field">
            <code>{result.requisite}</code>
            <button className="copy-btn" onClick={copyRequisite}>
              📋
            </button>
          </div>
        </div>
      )}

      {/* Кнопка «Я оплатил» */}
      {result.pending_id && (
        <button
          className="btn btn-primary btn-block"
          onClick={handleMarkPaid}
          disabled={notifying}
        >
          {notifying ? 'Отправка...' : '✅ Я оплатил'}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  successContainer: {
    textAlign: 'center' as const,
    padding: '40px 20px',
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 12,
  },
  successText: {
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: '1.6',
  },
};
