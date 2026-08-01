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
  const [copiedReq, setCopiedReq] = useState(false);

  useEffect(() => {
    showBackButton(() => navigate('plans'));
    return () => hideBackButton();
  }, [navigate, showBackButton, hideBackButton]);

  useEffect(() => {
    async function init() {
      try {
        const data = await createPurchase(planId, methodId);
        setResult(data);
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
      setCopiedReq(true);
      haptic();
      setTimeout(() => setCopiedReq(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [result, haptic]);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 32, width: '50%', marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 18 }} />
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
            style={{ marginTop: 20 }}
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
          <div style={styles.successGlow} />
          <div style={styles.successIcon}>✅</div>
          <h2 style={styles.successTitle}>Заявка отправлена!</h2>
          <p style={styles.successText}>
            Администратор получил уведомление. После подтверждения оплаты
            ключ и инструкция придут автоматически в бот.
          </p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 28 }}
            onClick={() => navigate('home')}
          >
            На главную →
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="page">
      <h2 style={styles.pageTitle}>Оплата</h2>

      {/* Order summary */}
      <div className="card card-accent" style={{ marginBottom: 16 }}>
        <div className="info-row">
          <span className="label">Тариф</span>
          <span className="value">{result.plan_title}</span>
        </div>
        <div className="info-row">
          <span className="label">Сумма</span>
          <span className="value">
            <span className="glow-text" style={{ fontSize: 18, fontWeight: 800 }}>
              {result.amount_rub} ₽
            </span>
            {result.discount_percent > 0 && (
              <span style={{ fontSize: 12, color: 'var(--success)', marginLeft: 6, fontWeight: 600 }}>
                -{result.discount_percent}%
              </span>
            )}
          </span>
        </div>
        {result.order_code && (
          <div className="info-row">
            <span className="label">Код заказа</span>
            <span className="value" style={{
              color: 'var(--warning)',
              fontFamily: '"SF Mono", monospace',
              letterSpacing: '0.05em',
            }}>
              {result.order_code}
            </span>
          </div>
        )}
      </div>

      {/* Payment link */}
      {result.payment_url && (
        <button
          className="btn btn-primary btn-block"
          style={{ marginBottom: 12 }}
          onClick={handleOpenPayment}
        >
          💳 Перейти к оплате →
        </button>
      )}

      {/* Manual requisites */}
      {result.requisite && !result.payment_url && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <p className="section-title" style={{ marginBottom: 8 }}>{result.requisite_label}</p>
          <div className="copy-field" style={{ margin: 0 }}>
            <code>{result.requisite}</code>
            <button
              className={`copy-btn ${copiedReq ? 'copied' : ''}`}
              onClick={copyRequisite}
            >
              {copiedReq ? '✓' : '📋'}
            </button>
          </div>
        </div>
      )}

      {/* Mark paid */}
      {result.pending_id && (
        <button
          className="btn btn-primary btn-block"
          onClick={handleMarkPaid}
          disabled={notifying}
          style={notifying ? { opacity: 0.7 } : {}}
        >
          {notifying ? '⏳ Отправка...' : '✅ Я оплатил'}
        </button>
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
  successContainer: {
    textAlign: 'center' as const,
    padding: '48px 24px',
    position: 'relative' as const,
  },
  successGlow: {
    position: 'absolute' as const,
    top: '20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(52, 211, 153, 0.15), transparent 70%)',
    filter: 'blur(40px)',
    pointerEvents: 'none' as const,
  },
  successIcon: {
    fontSize: 72,
    marginBottom: 20,
    position: 'relative' as const,
    zIndex: 2,
    filter: 'drop-shadow(0 0 20px rgba(52, 211, 153, 0.3))',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 12,
    position: 'relative' as const,
    zIndex: 2,
  },
  successText: {
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: '1.6',
    position: 'relative' as const,
    zIndex: 2,
  },
};
