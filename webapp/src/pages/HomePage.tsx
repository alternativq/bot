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
      haptic('medium');
    } catch {
      /* clipboard not available */
    }
  }, [profile, haptic]);

  if (loading) {
    return (
      <div className="page">
        <div style={{ marginBottom: 20 }}>
          <div className="skeleton" style={{ width: '60%', height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: '40%', height: 16 }} />
        </div>
        <div className="card skeleton" style={{ height: 180, marginBottom: 16 }} />
        <div className="card skeleton" style={{ height: 60 }} />
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
        <div>
          <h1 style={styles.greeting}>Привет, {firstName}! 👋</h1>
          <p style={styles.subtitle}>
            ID: <span style={{ color: 'var(--link)' }}>{profile?.tg_id}</span>
          </p>
        </div>
      </div>

      {/* Subscription Card */}
      {sub ? (
        <div className="card" style={styles.subCard}>
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
              >
                📋 Копировать
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={styles.emptyCard}>
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
            Выбрать тариф
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div style={styles.quickActions}>
        <p className="section-title">Быстрые действия</p>
        <div style={styles.actionGrid}>
          <button
            className="card"
            style={styles.actionCard}
            onClick={() => {
              haptic();
              navigate('plans');
            }}
          >
            <span style={styles.actionIcon}>📋</span>
            <span style={styles.actionLabel}>Тарифы</span>
          </button>
          <button
            className="card"
            style={styles.actionCard}
            onClick={() => {
              haptic();
              navigate('subscription');
            }}
          >
            <span style={styles.actionIcon}>🔑</span>
            <span style={styles.actionLabel}>VPN</span>
          </button>
          <button
            className="card"
            style={styles.actionCard}
            onClick={() => {
              haptic();
              navigate('faq');
            }}
          >
            <span style={styles.actionIcon}>❓</span>
            <span style={styles.actionLabel}>FAQ</span>
          </button>
          <button
            className="card"
            style={styles.actionCard}
            onClick={() => {
              haptic();
              navigate('settings');
            }}
          >
            <span style={styles.actionIcon}>⚙️</span>
            <span style={styles.actionLabel}>Ещё</span>
          </button>
        </div>
      </div>

      {/* Discount badge */}
      {profile && profile.discount_percent > 0 && (
        <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 24 }}>🎁</span>
          <p style={{ fontWeight: 600, marginTop: 4 }}>
            Активная скидка: {profile.discount_percent}%
          </p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-secondary)',
  },
  subCard: {
    marginBottom: 20,
    background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.12), rgba(162, 155, 254, 0.06))',
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  subHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  subPlan: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 6,
  },
  daysLeft: {
    textAlign: 'center' as const,
    background: 'var(--gradient-accent)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    minWidth: 64,
  },
  daysNumber: {
    display: 'block',
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1,
    color: '#fff',
  },
  daysLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  subInfo: {
    marginBottom: 16,
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  emptyCard: {
    textAlign: 'center' as const,
    padding: '32px 20px',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    marginBottom: 20,
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
    padding: '16px 8px',
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'inherit',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
};
