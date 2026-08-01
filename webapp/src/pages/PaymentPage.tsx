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
          showToast('Подписка активирована!', 'success');
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
        <div className="skeleton" style={{ height: 40, width: '45%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 180, borderRadius: 20 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="icon">
            <AlertTriangle size={32} />
          </div>
          <div className="title">Не удалось создать заказ</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{error}</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
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
        <div style={{ textAlign: 'center', padding: '40px 16px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#ffffff', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2 size={44} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 850, color: '#ffffff', marginBottom: 8 }}>
            Оплата зарегистрирована!
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
            Администратор получил уведомление. После подтверждения подписка придет автоматически в бот.
          </p>
          <button
            className="btn btn-primary btn-block"
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          className="noir-icon-btn"
          onClick={() => {
            haptic('light');
            navigate('plans');
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 850, color: '#ffffff' }}>Оформление оплаты</div>
      </div>

      <div className="card card-accent" style={{ marginBottom: 16 }}>
        <div className="info-row">
          <span className="label">Тариф</span>
          <span className="value">{result.plan_title}</span>
        </div>

        <div className="info-row">
          <span className="label">Сумма к оплате</span>
          <span className="value" style={{ fontSize: 20, fontWeight: 850, color: '#ffffff' }}>
            {result.amount_rub} ₽
            {result.discount_percent > 0 && (
              <span className="noir-badge" style={{ marginLeft: 8 }}>
                -{result.discount_percent}%
              </span>
            )}
          </span>
        </div>

        {result.order_code && (
          <div className="info-row">
            <span className="label">Код заказа</span>
            <span className="value" style={{ fontFamily: 'JetBrains Mono', color: '#ffffff' }}>
              {result.order_code}
            </span>
          </div>
        )}
      </div>

      {result.payment_url && (
        <button
          className="btn btn-primary btn-block"
          style={{ marginBottom: 14 }}
          onClick={handleOpenPayment}
        >
          <ExternalLink size={16} />
          Перейти к оплате ({result.amount_rub} ₽)
        </button>
      )}

      {result.requisite && !result.payment_url && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
            {result.requisite_label || 'Реквизиты перевода'}
          </div>
          <div className="copy-field" style={{ margin: 0 }}>
            <code>{result.requisite}</code>
            <button
              className={`copy-btn ${copiedReq ? 'copied' : ''}`}
              onClick={copyRequisite}
            >
              {copiedReq ? <Check size={14} /> : <Copy size={14} />}
              {copiedReq ? '✓' : 'Копия'}
            </button>
          </div>
        </div>
      )}

      {result.pending_id && (
        <button
          className="btn btn-secondary btn-block"
          onClick={handleMarkPaid}
          disabled={notifying}
        >
          {notifying ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Отправка...
            </>
          ) : (
            <>
              <CheckCircle2 size={16} />Я оплатил
            </>
          )}
        </button>
      )}
    </div>
  );
}
