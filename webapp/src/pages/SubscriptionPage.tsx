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
  Smartphone,
  HardDrive,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';

interface SubscriptionPageProps {
  navigate: (page: Page) => void;
}

type OSTab = 'ios' | 'android' | 'windows' | 'mac';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} ГБ`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(0)} МБ`;
}

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
        /* handled by empty state */
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
      showToast('Ссылка-подписка скопирована в буфер', 'success');
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
      showToast('Ошибка загрузки QR-кода', 'error');
    }
  }, [haptic, qrData, showQR, showToast]);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 32, width: '50%', marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 260, borderRadius: 20, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 18 }} />
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
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            У вас пока нет активной VPN-подписки
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
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

  // Traffic progress calculation
  const trafficUsed = sub.traffic ? sub.traffic.upload + sub.traffic.download : 0;
  const trafficTotal = sub.traffic?.total_bytes || 0;
  const trafficPercent = trafficTotal > 0 ? Math.min(100, (trafficUsed / trafficTotal) * 100) : 0;

  const OS_GUIDES: Record<OSTab, { appName: string; appStore: string; steps: string[] }> = {
    ios: {
      appName: 'Streisand / Happ / V2Box',
      appStore: 'App Store',
      steps: [
        'Установите Streisand или Happ из App Store',
        'Скопируйте ссылку-подписку выше',
        'Откройте приложение → нажмите «+» → «Import from Clipboard»',
        'Выберите сервер и включите VPN',
      ],
    },
    android: {
      appName: 'v2rayNG / Hiddify',
      appStore: 'Google Play',
      steps: [
        'Установите v2rayNG из Google Play',
        'Скопируйте ссылку-подписку',
        'В v2rayNG откройте меню → «Группы» → добавьте подписку',
        'Обновите серверы и нажмите кнопку подключения',
      ],
    },
    windows: {
      appName: 'v2rayN / Hiddify',
      appStore: 'GitHub / Официальный сайт',
      steps: [
        'Скачайте v2rayN или Hiddify для Windows',
        'Распакуйте и запустите от имени администратора',
        'Добавьте ссылку подписки через меню «Подписка»',
        'Обновите список серверов и включите режим системного прокси',
      ],
    },
    mac: {
      appName: 'FoXray / Hiddify',
      appStore: 'App Store / GitHub',
      steps: [
        'Установите FoXray или Hiddify',
        'Нажмите «Import from Clipboard» или вставьте вашу ссылку-подписку',
        'Разрешите добавление конфигурации VPN в macOS',
        'Выберите оптимальный сервер и подключитесь',
      ],
    },
  };

  return (
    <div className="page">
      <h2 style={styles.pageTitle}>Моя подписка</h2>

      {/* Main Subscription Card */}
      <div className="card card-accent" style={styles.statusCard}>
        <div className="glow-orb" style={{ top: -40, right: -20 }} />

        <div style={styles.statusHeader}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={styles.planTitle}>{sub.plan_title}</div>
            <span className={`badge ${sub.active ? 'badge-success' : 'badge-danger'}`}>
              <span className="pulse-dot" />
              {sub.active ? 'Активна' : sub.disabled ? 'Отключена' : 'Истекла'}
            </span>
          </div>

          <div style={styles.daysBlock}>
            <span style={styles.daysNum}>{sub.days_left}</span>
            <span style={styles.daysText}>дней</span>
          </div>
        </div>

        <div style={{ marginTop: 16, position: 'relative' as const, zIndex: 2 }}>
          <div className="info-row">
            <span className="label">
              <Calendar size={15} style={{ color: 'var(--text-muted)' }} /> Действует до
            </span>
            <span className="value">
              {new Date(sub.period_end).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="info-row">
            <span className="label">
              <Smartphone size={15} style={{ color: 'var(--text-muted)' }} /> Устройства
            </span>
            <span className="value">{sub.limit_ip ? `${sub.limit_ip} уст.` : 'Безлимит'}</span>
          </div>

          {sub.traffic && (
            <>
              <div className="info-row">
                <span className="label">
                  <HardDrive size={15} style={{ color: 'var(--text-muted)' }} /> Трафик
                </span>
                <span className="value">
                  {formatBytes(trafficUsed)}
                  {trafficTotal > 0 ? ` / ${formatBytes(trafficTotal)}` : ' · Безлимит'}
                </span>
              </div>

              {trafficTotal > 0 && (
                <div style={styles.progressContainer}>
                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressBar,
                        width: `${trafficPercent}%`,
                        background:
                          trafficPercent > 85
                            ? 'linear-gradient(90deg, var(--warning), var(--danger))'
                            : 'var(--accent-gradient)',
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Subscription Link & QR Code */}
      {sub.sub_link && (
        <div style={{ marginTop: 16 }}>
          <p className="section-title">Ссылка-подписка</p>
          <div className="card" style={{ padding: 16 }}>
            <div className="copy-field" style={{ margin: 0 }}>
              <code>{sub.sub_link}</code>
              <button
                className={`copy-btn ${copied ? 'copied' : ''}`}
                onClick={copyLink}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>

            <div style={styles.linkActions}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={loadQR}>
                <QrCode size={15} />
                {showQR ? 'Скрыть QR' : 'QR-код'}
                {showQR ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
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
              <div style={styles.qrContainer}>
                <div style={styles.qrFrame}>
                  <img
                    src={`data:image/png;base64,${qrData}`}
                    alt="QR Code"
                    style={styles.qrImage}
                  />
                </div>
                <p style={styles.qrHint}>Отсканируйте в вашем VPN-клиенте</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection Guide Tabs */}
      <div style={{ marginTop: 20 }}>
        <p className="section-title">Инструкция по настройке</p>

        <div className="tabs" style={{ marginBottom: 12 }}>
          {(['ios', 'android', 'windows', 'mac'] as OSTab[]).map((os) => (
            <button
              key={os}
              className={`tab ${activeOS === os ? 'active' : ''}`}
              onClick={() => {
                haptic('light');
                setActiveOS(os);
              }}
            >
              {os.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={styles.osHeader}>
            <Download size={18} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              Рекомендуемое ПО: {OS_GUIDES[activeOS].appName}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {OS_GUIDES[activeOS].steps.map((stepText, idx) => (
              <div key={idx} style={styles.guideStepRow}>
                <div style={styles.stepNumCircle}>{idx + 1}</div>
                <div style={{ flex: 1, fontSize: 13, lineHeight: '1.5', color: 'var(--text-primary)' }}>
                  {stepText}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
  statusCard: {
    position: 'relative' as const,
  },
  statusHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 8,
    letterSpacing: '-0.01em',
  },
  daysBlock: {
    textAlign: 'center' as const,
    background: 'var(--accent-gradient)',
    borderRadius: 14,
    padding: '10px 20px',
    boxShadow: '0 4px 20px var(--accent-glow)',
    position: 'relative' as const,
    zIndex: 2,
  },
  daysNum: {
    display: 'block',
    fontSize: 26,
    fontWeight: 800,
    lineHeight: 1,
    color: '#ffffff',
  },
  daysText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  },
  progressContainer: {
    marginTop: 10,
  },
  progressTrack: {
    height: 5,
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
    transition: 'width 0.4s ease',
  },
  linkActions: {
    display: 'flex',
    gap: 10,
    marginTop: 12,
  },
  qrContainer: {
    marginTop: 16,
    textAlign: 'center' as const,
    paddingTop: 16,
    borderTop: '1px solid var(--glass-border)',
  },
  qrFrame: {
    display: 'inline-block',
    padding: 12,
    background: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  qrImage: {
    width: 170,
    height: 170,
    display: 'block',
  },
  qrHint: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginTop: 10,
  },
  osHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottom: '1px solid var(--glass-border)',
  },
  guideStepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumCircle: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--accent-soft)',
    color: 'var(--accent-primary)',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid rgba(147, 51, 234, 0.3)',
  },
};
