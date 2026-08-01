import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { createPurchase, markPaid } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import type { PurchaseResult } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ArrowLeft,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface PaymentPageProps {
  navigate: (page: Page) => void;
  planId: string;
  methodId?: string;
}

export function PaymentPage({ navigate, planId, methodId }: PaymentPageProps) {
  const { tg, haptic, showBackButton, hideBackButton } = useTelegram();
  const { showToast } = useToast();
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
          showToast('Подписка успешно активирована!', 'success');
          navigate('subscription');
          return;
        }
      } catch (err: any) {
        const errMsg = err.message || 'Ошибка создания заказа';
        setError(errMsg);
        showToast(errMsg, 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [planId, methodId, navigate, showToast]);

  const handleOpenPayment = useCallback(() => {
    if (!result?.payment_url) return;
    haptic('heavy');
    tg?.openLink(result.payment_url);
  }, [result, haptic, tg]);

  const handleMarkPaid = useCallback(async () => {
    if (!result?.pending_id) return;
    haptic('heavy');
    setNotifying(true);
    try {
      await markPaid(result.pending_id);
      setNotified(true);
      showToast('Уведомление об оплате отправлено!', 'success');
    } catch {
      showToast('Ошибка отправки уведомления', 'error');
    } finally {
      setNotifying(false);
    }
  }, [result, haptic, showToast]);

  const copyRequisite = useCallback(async () => {
    if (!result?.requisite) return;
    try {
      await navigator.clipboard.writeText(result.requisite);
      setCopiedReq(true);
      showToast('Реквизиты скопированы', 'success');
      setTimeout(() => setCopiedReq(false), 2000);
    } catch {
      showToast('Не удалось скопировать', 'error');
    }
  }, [result, showToast]);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 32, width: '45%', marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 180, borderRadius: 20, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 48, borderRadius: 14 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="icon" style={{ color: 'var(--danger)' }}>
            <AlertTriangle size={32} />
          </div>
          <div className="title">Не удалось создать заказ</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{error}</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => {
              haptic('medium');
              navigate('plans');
            }}
          >
            ← Назад к тарифам
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
          <div style={styles.successIconWrapper}>
            <CheckCircle2 size={56} style={{ color: 'var(--success)' }} />
          </div>
          <h2 style={styles.successTitle}>Оплата зарегистрирована!</h2>
          <p style={styles.successText}>
            Администратор получил уведомление. После подтверждения подписка и ключи придут
            автоматически в диалог с ботом.
          </p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 28 }}
            onClick={() => {
              haptic('medium');
              navigate('home');
            }}
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
      <div style={styles.headerRow}>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => {
            haptic('light');
            navigate('plans');
          }}
          style={{ width: 36, height: 36 }}
        >
          <ArrowLeft size={18} />
        </button>
        <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Оформление оплаты</h2>
      </div>

      {/* Order Summary Card */}
      <div className="card card-accent" style={{ marginBottom: 16, marginTop: 16 }}>
        <div className="info-row">
          <span className="label">Тариф</span>
          <span className="value">{result.plan_title}</span>
        </div>

        <div className="info-row">
          <span className="label">Сумма к оплате</span>
          <span className="value">
            <span className="glow-text" style={{ fontSize: 20, fontWeight: 800 }}>
              {result.amount_rub} ₽
            </span>
            {result.discount_percent > 0 && (
              <span className="badge badge-success" style={{ marginLeft: 8 }}>
                -{result.discount_percent}%
              </span>
            )}
          </span>
        </div>

        {result.order_code && (
          <div className="info-row">
            <span className="label">Код заказа</span>
            <span
              className="value"
              style={{
                color: 'var(--warning)',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '0.05em',
              }}
            >
              {result.order_code}
            </span>
          </div>
        )}
      </div>

      {/* Direct Gateway Payment URL */}
      {result.payment_url && (
        <button
          className="btn btn-primary btn-block"
          style={{ marginBottom: 16 }}
          onClick={handleOpenPayment}
        >
          <ExternalLink size={18} />
          Перейти к оплате ({result.amount_rub} ₽)
        </button>
      )}

      {/* Manual Requisites */}
      {result.requisite && !result.payment_url && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <p className="section-title" style={{ marginBottom: 8 }}>
            {result.requisite_label || 'Реквизиты для перевода'}
          </p>
          <div className="copy-field" style={{ margin: 0 }}>
            <code>{result.requisite}</code>
            <button
              className={`copy-btn ${copiedReq ? 'copied' : ''}`}
              onClick={copyRequisite}
            >
              {copiedReq ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      )}

      {/* Confirm Payment Button */}
      {result.pending_id && (
        <button
          className="btn btn-secondary btn-block"
          onClick={handleMarkPaid}
          disabled={notifying}
          style={notifying ? { opacity: 0.7 } : {}}
        >
          {notifying ? (
            <>
              <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
              Отправка уведомления...
            </>
          ) : (
            <>
              <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />Я оплатил
            </>
          )}
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
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  successContainer: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    position: 'relative' as const,
  },
  successGlow: {
    position: 'absolute' as const,
    top: '15%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 220,
    height: 220,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25), transparent 70%)',
    filter: 'blur(45px)',
    pointerEvents: 'none' as const,
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    position: 'relative' as const,
    zIndex: 2,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 10,
    position: 'relative' as const,
    zIndex: 2,
  },
  successText: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: '1.6',
    position: 'relative' as const,
    zIndex: 2,
  },
};
