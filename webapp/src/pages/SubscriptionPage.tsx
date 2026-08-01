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
        <div className="skeleton" style={{ height: 32, width: '60%', marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 280, borderRadius: 18 }} />
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
            style={{ marginTop: 24 }}
            onClick={() => {
              haptic();
              navigate('plans');
            }}
          >
            Выбрать тариф →
          </button>
        </div>
      </div>
    );
  }

  // Traffic progress
  const trafficUsed = sub.traffic ? sub.traffic.upload + sub.traffic.download : 0;
  const trafficTotal = sub.traffic?.total_bytes || 0;
  const trafficPercent = trafficTotal > 0 ? Math.min(100, (trafficUsed / trafficTotal) * 100) : 0;

  return (
    <div className="page">
      <h2 style={styles.pageTitle}>Моя подписка</h2>

      {/* Status card */}
      <div className="card card-accent" style={styles.statusCard}>
        <div className="glow-orb" style={{ top: -50, right: -30 }} />

        <div style={styles.statusHeader}>
          <div style={{ position: 'relative', zIndex: 2 }}>
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

        <div style={{ marginTop: 16, position: 'relative' as const, zIndex: 2 }}>
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
            <>
              <div className="info-row">
                <span className="label">Трафик</span>
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
                        background: trafficPercent > 80
                          ? 'linear-gradient(90deg, var(--warning), var(--danger))'
                          : 'var(--gradient-accent)',
                      }}
                    />
                  </div>
                </div>
              )}
            </>
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
                {showQR ? '🔼 Скрыть' : '📱 QR-код'}
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
                <div style={styles.qrFrame}>
                  <img
                    src={`data:image/png;base64,${qrData}`}
                    alt="QR"
                    style={styles.qrImage}
                  />
                </div>
                <p style={styles.qrHint}>Отсканируйте в VPN-клиенте</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection guide */}
      <div style={{ marginTop: 16 }}>
        <p className="section-title">Как подключиться</p>
        <div className="card" style={{ padding: 0 }}>
          {[
            {
              num: '1',
              title: 'Установите приложение',
              desc: 'Android → v2rayNG · iOS → Streisand / Happ\nWindows → v2rayN · macOS → FoXray',
            },
            {
              num: '2',
              title: 'Добавьте подписку',
              desc: '«Import from URL» или отсканируйте QR-код',
            },
            {
              num: '3',
              title: 'Подключайтесь',
              desc: 'Обновите серверы и нажмите «Connect»',
            },
          ].map((step, idx) => (
            <div key={idx} style={{ ...styles.step, borderBottom: idx < 2 ? '1px solid var(--divider)' : 'none' }}>
              <span style={styles.stepNum}>{step.num}</span>
              <div style={{ flex: 1 }}>
                <div style={styles.stepTitle}>{step.title}</div>
                <div style={styles.stepDesc}>{step.desc}</div>
              </div>
            </div>
          ))}
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
    overflow: 'hidden',
  },
  statusHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planTitle: {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 10,
    letterSpacing: '-0.01em',
  },
  daysBlock: {
    textAlign: 'center' as const,
    background: 'var(--gradient-accent)',
    borderRadius: 14,
    padding: '12px 22px',
    boxShadow: '0 4px 24px rgba(124, 108, 240, 0.35)',
    position: 'relative' as const,
    zIndex: 2,
  },
  daysNum: {
    display: 'block',
    fontSize: 30,
    fontWeight: 800,
    lineHeight: 1,
    color: '#fff',
  },
  daysText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 500,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 4,
    background: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.5s ease',
    boxShadow: '0 0 8px rgba(124, 108, 240, 0.3)',
  },
  linkActions: {
    display: 'flex',
    gap: 8,
    marginTop: 14,
  },
  qrContainer: {
    marginTop: 20,
    textAlign: 'center' as const,
  },
  qrFrame: {
    display: 'inline-block',
    padding: 12,
    background: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 0 40px rgba(124, 108, 240, 0.08)',
  },
  qrImage: {
    width: 180,
    height: 180,
    display: 'block',
  },
  qrHint: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginTop: 10,
  },
  step: {
    display: 'flex',
    gap: 14,
    padding: '16px 20px',
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'var(--gradient-accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(124, 108, 240, 0.25)',
  },
  stepTitle: {
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 3,
  },
  stepDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    whiteSpace: 'pre-line' as const,
  },
};
