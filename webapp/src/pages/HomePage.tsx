import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { authenticate, getMe, setAuthToken, getAuthToken } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import type { UserProfile } from '../types';

interface HomePageProps {
  navigate: (page: Page) => void;
}

export function HomePage({ navigate }: HomePageProps) {
  const { user, initData, haptic } = useTelegram();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        if (!getAuthToken() && initData) {
          const { token } = await authenticate(initData);
          setAuthToken(token);
        }
        if (getAuthToken()) {
          const data = await getMe();
          setProfile(data);
        }
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [initData]);

  const copyLink = useCallback(async () => {
    if (!profile?.subscription?.sub_link) return;
    try {
      await navigator.clipboard.writeText(profile.subscription.sub_link);
      setCopied(true);
      haptic('medium');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [profile, haptic]);

  if (loading) {
    return (
      <div className="page">
        <div style={{ marginBottom: 24 }}>
          <div className="skeleton" style={{ width: '55%', height: 32, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: '35%', height: 16 }} />
        </div>
        <div className="skeleton" style={{ height: 200, marginBottom: 16, borderRadius: 18 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 76, borderRadius: 18 }} />
          ))}
        </div>
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
        </div>
      </div>
    );
  }

  const sub = profile?.subscription;
  const firstName = user?.first_name || profile?.username || 'User';

  return (
    <div className="page">
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.greeting}>
          Привет, <span className="glow-text">{firstName}</span>! 👋
        </h1>
        <p style={styles.subtitle}>
          ID: <span style={{ color: 'var(--link)', fontFamily: 'monospace' }}>{profile?.tg_id}</span>
        </p>
      </div>

      {/* Subscription Card */}
      {sub ? (
        <div className="card card-accent" style={styles.subCard}>
          {/* Glow orb */}
          <div className="glow-orb" style={{ top: -40, right: -20 }} />

          <div style={styles.subHeader}>
            <div>
              <div style={styles.subPlan}>{sub.plan_title}</div>
              <span className={`badge ${sub.active ? 'badge-success' : 'badge-danger'}`}>
                {sub.active ? '● Активна' : '● Истекла'}
              </span>
            </div>
            <div style={styles.daysLeft}>
              <span style={styles.daysNumber}>{sub.days_left}</span>
              <span style={styles.daysLabel}>дней</span>
            </div>
          </div>

          <div style={styles.subInfo}>
            <div className="info-row">
              <span className="label">Действует до</span>
              <span className="value">
                {new Date(sub.period_end).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="info-row">
              <span className="label">Устройства</span>
              <span className="value">{sub.limit_ip || '∞'}</span>
            </div>
          </div>

          {sub.sub_link && (
            <div style={styles.actions}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  haptic();
                  navigate('subscription');
                }}
              >
                🔑 Подключение
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={copyLink}
                style={copied ? { borderColor: 'rgba(52, 211, 153, 0.3)', color: 'var(--success)' } : {}}
              >
                {copied ? '✓ Скопировано' : '📋 Копировать'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card card-accent" style={styles.emptyCard}>
          <div className="glow-orb" style={{ top: -30, left: '50%', transform: 'translateX(-50%)' }} />
          <div style={styles.emptyIcon}>🛡️</div>
          <h3 style={styles.emptyTitle}>Нет активной подписки</h3>
          <p style={styles.emptyText}>
            Выберите тариф и получите VPN за пару минут
          </p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              haptic();
              navigate('plans');
            }}
          >
            Выбрать тариф →
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div style={styles.quickActions}>
        <p className="section-title">Быстрые действия</p>
        <div style={styles.actionGrid}>
          {[
            { icon: '📋', label: 'Тарифы', page: 'plans' as Page },
            { icon: '🔑', label: 'VPN', page: 'subscription' as Page },
            { icon: '❓', label: 'FAQ', page: 'faq' as Page },
            { icon: '⚙️', label: 'Ещё', page: 'settings' as Page },
          ].map((item) => (
            <button
              key={item.page}
              className="card"
              style={styles.actionCard}
              onClick={() => {
                haptic();
                navigate(item.page);
              }}
            >
              <span style={styles.actionIcon}>{item.icon}</span>
              <span style={styles.actionLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Discount badge */}
      {profile && profile.discount_percent > 0 && (
        <div className="card" style={styles.discountCard}>
          <span style={{ fontSize: 24 }}>🎁</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15 }}>
              Скидка <span className="glow-text">{profile.discount_percent}%</span>
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Применяется к следующей покупке
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 26,
    fontWeight: 800,
    marginBottom: 4,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  subCard: {
    marginBottom: 24,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  subHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    position: 'relative' as const,
    zIndex: 2,
  },
  subPlan: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 8,
    letterSpacing: '-0.01em',
  },
  daysLeft: {
    textAlign: 'center' as const,
    background: 'var(--gradient-accent)',
    borderRadius: '14px',
    padding: '10px 20px',
    minWidth: 70,
    boxShadow: '0 4px 20px rgba(124, 108, 240, 0.3)',
  },
  daysNumber: {
    display: 'block',
    fontSize: 26,
    fontWeight: 800,
    lineHeight: 1,
    color: '#fff',
  },
  daysLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 500,
  },
  subInfo: {
    marginBottom: 16,
    position: 'relative' as const,
    zIndex: 2,
  },
  actions: {
    display: 'flex',
    gap: 8,
    position: 'relative' as const,
    zIndex: 2,
  },
  emptyCard: {
    textAlign: 'center' as const,
    padding: '36px 24px',
    marginBottom: 24,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 16,
    filter: 'drop-shadow(0 0 20px rgba(124, 108, 240, 0.2))',
    position: 'relative' as const,
    zIndex: 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 8,
    position: 'relative' as const,
    zIndex: 2,
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    marginBottom: 24,
    lineHeight: '1.5',
    position: 'relative' as const,
    zIndex: 2,
  },
  quickActions: {
    marginTop: 4,
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  actionCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px 8px',
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'inherit',
  },
  actionIcon: {
    fontSize: 26,
    marginBottom: 6,
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    letterSpacing: '0.01em',
  },
  discountCard: {
    marginTop: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '16px 20px',
    borderColor: 'rgba(52, 211, 153, 0.15)',
    background: 'rgba(52, 211, 153, 0.04)',
  },
};
