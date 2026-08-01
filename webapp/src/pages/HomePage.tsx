import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { authenticate, getMe, setAuthToken, getAuthToken } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import type { UserProfile } from '../types';
import {
  ShieldCheck,
  Copy,
  Check,
  Zap,
  Layers,
  HelpCircle,
  Settings,
  Gift,
  AlertTriangle,
  ChevronRight,
  Wifi,
  Key,
} from 'lucide-react';

interface HomePageProps {
  navigate: (page: Page) => void;
}

export function HomePage({ navigate }: HomePageProps) {
  const { user, initData, haptic } = useTelegram();
  const { showToast } = useToast();
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
      showToast('Ссылка-подписка скопирована в буфер', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Не удалось скопировать', 'error');
    }
  }, [profile, showToast]);

  if (loading) {
    return (
      <div className="page">
        <div style={{ marginBottom: 24 }}>
          <div className="skeleton" style={{ width: '55%', height: 32, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: '35%', height: 16 }} />
        </div>
        <div className="skeleton" style={{ height: 210, marginBottom: 20, borderRadius: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 84, borderRadius: 18 }} />
          ))}
        </div>
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
          <div className="title">Ошибка подключения</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      </div>
    );
  }

  const sub = profile?.subscription;
  const firstName = user?.first_name || profile?.username || 'Пользователь';

  return (
    <div className="page">
      {/* Top Header */}
      <div style={styles.header}>
        <div style={styles.greetingContainer}>
          <h1 style={styles.greeting}>
            Привет, <span className="glow-text">{firstName}</span> 👋
          </h1>
          <p style={styles.subtitle}>
            ID: <span style={styles.idBadge}>{profile?.tg_id}</span>
          </p>
        </div>
        <div style={styles.networkBadge}>
          <Wifi size={14} style={{ color: 'var(--success)' }} />
          <span>Онлайн</span>
        </div>
      </div>

      {/* Subscription Hero Card */}
      {sub ? (
        <div className="card card-accent" style={styles.subCard}>
          <div className="glow-orb" style={{ top: -30, right: -20 }} />

          <div style={styles.subHeader}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={styles.subPlan}>{sub.plan_title}</div>
              <span className={`badge ${sub.active ? 'badge-success' : 'badge-danger'}`}>
                <span className="pulse-dot" />
                {sub.active ? 'Активна' : 'Истекла'}
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
              <span className="label">Лимит устройств</span>
              <span className="value">{sub.limit_ip ? `${sub.limit_ip} уст.` : 'Безлимит'}</span>
            </div>
          </div>

          {sub.sub_link && (
            <div style={styles.actions}>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
                onClick={() => {
                  haptic('medium');
                  navigate('subscription');
                }}
              >
                <Key size={16} />
                Подключение
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={copyLink}
                style={
                  copied
                    ? { borderColor: 'rgba(16, 185, 129, 0.3)', color: 'var(--success)' }
                    : {}
                }
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Скопировано' : 'Ссылка'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card card-accent" style={styles.emptyCard}>
          <div
            className="glow-orb"
            style={{ top: -20, left: '50%', transform: 'translateX(-50%)' }}
          />
          <div style={styles.emptyIconWrapper}>
            <ShieldCheck size={36} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 style={styles.emptyTitle}>Нет активной подписки</h3>
          <p style={styles.emptyText}>
            Выберите лучший тариф и мгновенно подключите безопасный VPN
          </p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              haptic('medium');
              navigate('plans');
            }}
          >
            <Zap size={18} />
            Выбрать тариф
          </button>
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div style={styles.quickActions}>
        <p className="section-title">Быстрый доступ</p>
        <div style={styles.actionGrid}>
          {[
            { icon: Layers, label: 'Тарифы', page: 'plans' as Page, color: '#9333ea' },
            { icon: Key, label: 'VPN', page: 'subscription' as Page, color: '#3b82f6' },
            { icon: HelpCircle, label: 'FAQ', page: 'faq' as Page, color: '#10b981' },
            { icon: Settings, label: 'Ещё', page: 'settings' as Page, color: '#f59e0b' },
          ].map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.page}
                className="card card-interactive"
                style={styles.actionCard}
                onClick={() => {
                  haptic('light');
                  navigate(item.page);
                }}
              >
                <div
                  style={{
                    ...styles.actionIconWrapper,
                    background: `${item.color}15`,
                    borderColor: `${item.color}30`,
                  }}
                >
                  <IconComponent size={22} style={{ color: item.color }} />
                </div>
                <span style={styles.actionLabel}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Discount notification badge */}
      {profile && profile.discount_percent > 0 && (
        <div className="card" style={styles.discountCard}>
          <div style={styles.discountIconWrapper}>
            <Gift size={22} style={{ color: 'var(--success)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Персональная скидка <span className="glow-text">{profile.discount_percent}%</span>
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Автоматически применится к вашей следующей покупке
            </p>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 4,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  idBadge: {
    color: 'var(--accent-primary)',
    fontFamily: 'monospace',
    fontWeight: 600,
  },
  networkBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--success)',
  },
  subCard: {
    marginBottom: 20,
    position: 'relative' as const,
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
    marginBottom: 6,
    letterSpacing: '-0.01em',
  },
  daysLeft: {
    textAlign: 'center' as const,
    background: 'var(--accent-gradient)',
    borderRadius: '14px',
    padding: '8px 18px',
    minWidth: 68,
    boxShadow: '0 4px 16px var(--accent-glow)',
  },
  daysNumber: {
    display: 'block',
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1,
    color: '#ffffff',
  },
  daysLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  },
  subInfo: {
    marginBottom: 16,
    position: 'relative' as const,
    zIndex: 2,
  },
  actions: {
    display: 'flex',
    gap: 10,
    position: 'relative' as const,
    zIndex: 2,
  },
  emptyCard: {
    textAlign: 'center' as const,
    padding: '32px 20px',
    marginBottom: 20,
    position: 'relative' as const,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'var(--accent-soft)',
    border: '1px solid rgba(147, 51, 234, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    position: 'relative' as const,
    zIndex: 2,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: 800,
    marginBottom: 6,
    position: 'relative' as const,
    zIndex: 2,
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    marginBottom: 20,
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
    gap: 10,
  },
  actionCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 8px',
    border: '1px solid var(--glass-border)',
    fontFamily: 'inherit',
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    border: '1px solid transparent',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: 650,
    color: 'var(--text-primary)',
  },
  discountCard: {
    marginTop: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderColor: 'rgba(16, 185, 129, 0.2)',
    background: 'rgba(16, 185, 129, 0.04)',
  },
  discountIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'rgba(16, 185, 129, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
