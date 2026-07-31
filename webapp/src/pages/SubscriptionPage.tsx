import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { getSubscription, getSubscriptionQR } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import type { SubscriptionInfo } from '../types';

interface SubscriptionPageProps {
  navigate: (page: Page) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(2)} ГБ`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(0)} МБ`;
}

export function SubscriptionPage({ navigate }: SubscriptionPageProps) {
  const { haptic, showBackButton, hideBackButton } = useTelegram();
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
      haptic('medium');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [sub, haptic]);

  const loadQR = useCallback(async () => {
    haptic();
    if (qrData) {
      setShowQR(!showQR);
      return;
    }
    try {
      const data = await getSubscriptionQR();
      setQrData(data.qr_base64);
      setShowQR(true);
    } catch {
      /* error */
    }
  }, [haptic, qrData, showQR]);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 28, width: '60%', marginBottom: 20 }} />
        <div className="card skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="icon">🔑</div>
          <div className="title">Нет подписки</div>
          <p>У вас пока нет активной VPN-подписки</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => {
              haptic();
              navigate('plans');
            }}
          >
            Выбрать тариф
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Моя подписка</h2>

      {/* Status card */}
      <div className="card" style={styles.statusCard}>
        <div style={styles.statusHeader}>
          <div>
            <div style={styles.planTitle}>{sub.plan_title}</div>
            <span className={`badge ${sub.active ? 'badge-success' : 'badge-danger'}`}>
              {sub.active ? '● Активна' : sub.disabled ? '● Отключена' : '● Истекла'}
            </span>
          </div>
          <div style={styles.daysBlock}>
            <span style={styles.daysNum}>{sub.days_left}</span>
            <span style={styles.daysText}>дней</span>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
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
            <span className="label">Устройства</span>
            <span className="value">{sub.limit_ip || '∞'}</span>
          </div>
          {sub.traffic && (
            <div className="info-row">
              <span className="label">Трафик</span>
              <span className="value">
                {formatBytes(sub.traffic.upload + sub.traffic.download)}
                {sub.traffic.total_bytes > 0
                  ? ` / ${formatBytes(sub.traffic.total_bytes)}`
                  : ' · Безлимит'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Subscription link */}
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
                {copied ? '✓' : '📋'}
              </button>
            </div>

            <div style={styles.linkActions}>
              <button className="btn btn-secondary btn-sm" onClick={loadQR}>
                {showQR ? '🔼 Скрыть QR' : '📱 QR-код'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  haptic();
                  navigate('plans');
                }}
              >
                🔄 Продлить
              </button>
            </div>

            {showQR && qrData && (
              <div style={styles.qrContainer}>
                <img
                  src={`data:image/png;base64,${qrData}`}
                  alt="QR"
                  style={styles.qrImage}
                />
                <p style={styles.qrHint}>
                  Отсканируйте в приложении VPN-клиента
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection guide */}
      <div style={{ marginTop: 16 }}>
        <p className="section-title">Как подключиться</p>
        <div className="card" style={{ padding: 16 }}>
          <div style={styles.step}>
            <span style={styles.stepNum}>1</span>
            <div>
              <div style={styles.stepTitle}>Установите приложение</div>
              <div style={styles.stepDesc}>
                Android → v2rayNG · iOS → Streisand / Happ<br />
                Windows → v2rayN / Hiddify · macOS → FoXray
              </div>
            </div>
          </div>
          <div style={styles.step}>
            <span style={styles.stepNum}>2</span>
            <div>
              <div style={styles.stepTitle}>Добавьте подписку</div>
              <div style={styles.stepDesc}>
                «Import from URL» или отсканируйте QR-код выше
              </div>
            </div>
          </div>
          <div style={{ ...styles.step, borderBottom: 'none' }}>
            <span style={styles.stepNum}>3</span>
            <div>
              <div style={styles.stepTitle}>Подключайтесь</div>
              <div style={styles.stepDesc}>
                Обновите список серверов и нажмите «Connect»
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  statusCard: {
    background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.12), rgba(162, 155, 254, 0.06))',
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  statusHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 8,
  },
  daysBlock: {
    textAlign: 'center' as const,
    background: 'var(--gradient-accent)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 20px',
  },
  daysNum: {
    display: 'block',
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1,
    color: '#fff',
  },
  daysText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  linkActions: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  qrContainer: {
    marginTop: 16,
    textAlign: 'center' as const,
    padding: '16px 0',
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    background: '#fff',
    padding: 8,
  },
  qrHint: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginTop: 8,
  },
  step: {
    display: 'flex',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid var(--divider)',
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--gradient-accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  stepTitle: {
    fontWeight: 600,
    fontSize: 15,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
};
