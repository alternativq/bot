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
} from 'lucide-react';

interface SubscriptionPageProps {
  navigate: (page: Page) => void;
}

type OSTab = 'ios' | 'android' | 'windows' | 'mac';

export function SubscriptionPage({ navigate }: SubscriptionPageProps) {
  const { haptic, showBackButton, hideBackButton } = useTelegram();
  const { showToast } = useToast();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeOS, setActiveOS] = useState<OSTab>('ios');

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

  const OS_GUIDES: Record<OSTab, { appName: string; steps: string[] }> = {
    ios: {
      appName: 'Streisand / Happ / V2Box',
      steps: [
        'Установите Streisand или Happ из App Store',
        'Скопируйте ссылку-подписку выше',
        'В приложении нажмите «+» → «Import from Clipboard»',
        'Подключайтесь к выбранному серверу',
      ],
    },
    android: {
      appName: 'v2rayNG / Hiddify',
      steps: [
        'Установите v2rayNG из Google Play',
        'Скопируйте ссылку-подписку',
        'В v2rayNG откройте меню → «Группы» → добавьте подписку',
        'Обновите серверы и нажмите кнопку подключения',
      ],
    },
    windows: {
      appName: 'v2rayN / Hiddify',
      steps: [
        'Скачайте v2rayN или Hiddify для Windows',
        'Распакуйте и запустите от имени администратора',
        'Добавьте ссылку подписки через меню «Подписка»',
        'Включите режим системного прокси',
      ],
    },
    mac: {
      appName: 'FoXray / Hiddify',
      steps: [
        'Установите FoXray или Hiddify для macOS',
        'Нажмите «Import from Clipboard»',
        'Разрешите добавление VPN конфигурации',
        'Подключитесь к серверу',
      ],
    },
  };

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
            <span className="noir-badge">
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
          <div className="noir-section-title">С С Ы Л К А  П О Д П И С К И</div>

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

      {/* OS Setup Guide */}
      <div className="noir-section-title">И Н С Т Р У К Ц И Я  П О  Н А С Т Р О Й К Е</div>

      <div className="noir-pills-scroll">
        {(['ios', 'android', 'windows', 'mac'] as OSTab[]).map((os) => (
          <button
            key={os}
            className={`noir-pill ${activeOS === os ? 'active' : ''}`}
            onClick={() => {
              haptic('light');
              setActiveOS(os);
            }}
          >
            {os.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginBottom: 12 }}>
          Рекомендуемое ПО: {OS_GUIDES[activeOS].appName}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OS_GUIDES[activeOS].steps.map((step, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#ffffff', color: '#000000', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {idx + 1}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                {step}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
