import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { getSubscription, getSubscriptionQR } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import type { SubscriptionInfo } from '../types';
import {
  Key,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  ArrowLeft,
  Zap,
} from 'lucide-react';

interface SubscriptionPageProps {
  navigate: (page: Page) => void;
}

export function SubscriptionPage({ navigate }: SubscriptionPageProps) {
  const { haptic, showBackButton, hideBackButton } = useTelegram();
  const { showToast } = useToast();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    showBackButton(() => navigate('home'));
    return () => hideBackButton();
  }, [navigate, showBackButton, hideBackButton]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSubscription();
        setSub(data.subscription);
      } catch {
        /* handled */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const copyLink = useCallback(async () => {
    if (!sub?.sub_link) return;
    try {
      await navigator.clipboard.writeText(sub.sub_link);
      setCopied(true);
      showToast('Ссылка скопирована в буфер', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Не удалось скопировать', 'error');
    }
  }, [sub, showToast]);

  const loadQR = useCallback(async () => {
    haptic('light');
    if (qrData) {
      setShowQR(!showQR);
      return;
    }
    try {
      const data = await getSubscriptionQR();
      setQrData(data.qr_base64);
      setShowQR(true);
      showToast('QR-код готов к сканированию', 'info');
    } catch {
      showToast('Ошибка загрузки QR', 'error');
    }
  }, [haptic, qrData, showQR, showToast]);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 40, width: '45%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 220, borderRadius: 20 }} />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="icon">
            <Key size={32} />
          </div>
          <div className="title">Нет подписки</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            У вас пока нет активной VPN-подписки
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => {
              haptic('medium');
              navigate('plans');
            }}
          >
            Выбрать тариф →
          </button>
        </div>
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
        <div style={{ fontSize: 18, fontWeight: 850, color: '#ffffff' }}>Моя подписка</div>
      </div>

      <div className="card card-accent" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 850, color: '#ffffff', marginBottom: 6 }}>
              {sub.plan_title}
            </div>
            <span
              className="noir-badge"
              style={{
                background: sub.active ? 'var(--success)' : 'rgba(239, 68, 68, 0.2)',
                color: '#ffffff',
                border: sub.active ? 'none' : '1px solid var(--danger)',
                boxShadow: sub.active ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
              }}
            >
              {sub.active ? '● АКТИВНА' : '● ИСТЕКЛА'}
            </span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
              {sub.days_left}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              дней осталось
            </div>
          </div>
        </div>

        <div className="info-row">
          <span className="label">Действует до</span>
          <span className="value">
            {new Date(sub.period_end).toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="info-row">
          <span className="label">Лимит устройств</span>
          <span className="value">{sub.limit_ip ? `${sub.limit_ip} шт.` : 'Безлимит'}</span>
        </div>
      </div>

      {/* Subscription link */}
      {sub.sub_link && (
        <div style={{ marginBottom: 20 }}>
          <div className="noir-section-title">СЕКРЕТНЫЙ КЛЮЧ ПОДПИСКИ</div>

          <div className="card">
            <div className="copy-field" style={{ margin: 0 }}>
              <code>{sub.sub_link}</code>
              <button
                className={`copy-btn ${copied ? 'copied' : ''}`}
                onClick={copyLink}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '✓' : 'Копия'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={loadQR}>
                <QrCode size={15} />
                {showQR ? 'Скрыть QR' : '📱 QR-код'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
                onClick={() => {
                  haptic('medium');
                  navigate('plans');
                }}
              >
                <RefreshCw size={15} />
                Продлить
              </button>
            </div>

            {showQR && qrData && (
              <div style={{ marginTop: 16, textAlign: 'center', paddingTop: 16, borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'inline-block', padding: 12, background: '#ffffff', borderRadius: 16 }}>
                  <img
                    src={`data:image/png;base64,${qrData}`}
                    alt="QR Code"
                    style={{ width: 170, height: 170, display: 'block' }}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Отсканируйте в вашем VPN-клиенте
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2 Recommended Apps: Happ & v2raytun */}
      <div className="noir-section-title">ПРИЛОЖЕНИЯ ДЛЯ ПОДКЛЮЧЕНИЯ</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
        Выберите ваше приложение и скопируйте ключ для настройки:
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        {/* App 1: Happ */}
        <div className="card card-accent" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: '#ffffff', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 850, color: '#ffffff' }}>Happ App</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>iOS · Android · Windows</div>
              </div>
            </div>
            <span className="noir-badge">РЕКОМЕНДУЕМ</span>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.45 }}>
            1. Установите <strong>Happ</strong> из App Store / Google Play.<br />
            2. Скопируйте ключ подписки кнопкой ниже.<br />
            3. В Happ нажмите <strong>«+» → Импорт из буфера</strong>.
          </div>

          <button
            className="btn btn-primary btn-block btn-sm"
            onClick={() => {
              haptic('medium');
              copyLink();
            }}
          >
            <Copy size={14} /> Скопировать ключ для Happ
          </button>
        </div>

        {/* App 2: v2raytun */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255, 255, 255, 0.12)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 850, color: '#ffffff' }}>v2raytun</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>iOS · Android · Windows</div>
              </div>
            </div>
            <span className="noir-badge noir-badge-dark">ОТЛИЧНЫЙ ВЫБОР</span>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.45 }}>
            1. Установите <strong>v2raytun</strong> из маркета.<br />
            2. Скопируйте ключ подписки кнопкой ниже.<br />
            3. В v2raytun нажмите <strong>«Вставить подписку»</strong>.
          </div>

          <button
            className="btn btn-secondary btn-block btn-sm"
            onClick={() => {
              haptic('medium');
              copyLink();
            }}
          >
            <Copy size={14} /> Скопировать ключ для v2raytun
          </button>
        </div>
      </div>
    </div>
  );
}
