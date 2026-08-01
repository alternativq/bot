import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { getMe, getReferral, applyPromo } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import type { ReferralInfo, UserProfile } from '../types';
import {
  User,
  Gift,
  Tag,
  HelpCircle,
  History,
  MessageSquare,
  ChevronRight,
  Copy,
  Check,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface SettingsPageProps {
  navigate: (page: Page) => void;
}

export function SettingsPage({ navigate }: SettingsPageProps) {
  const { tg, haptic, showBackButton, hideBackButton } = useTelegram();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoResult, setPromoResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    showBackButton(() => navigate('home'));
    return () => hideBackButton();
  }, [navigate, showBackButton, hideBackButton]);

  useEffect(() => {
    async function load() {
      try {
        const [me, ref] = await Promise.all([getMe(), getReferral()]);
        setProfile(me);
        setReferral(ref);
      } catch {
        /* handled */
      }
    }
    load();
  }, []);

  const copyRefLink = useCallback(async () => {
    if (!referral?.referral_link) return;
    try {
      await navigator.clipboard.writeText(referral.referral_link);
      setCopiedRef(true);
      showToast('Реферальная ссылка скопирована', 'success');
      setTimeout(() => setCopiedRef(false), 2000);
    } catch {
      showToast('Не удалось скопировать', 'error');
    }
  }, [referral, showToast]);

  const handleApplyPromo = useCallback(async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const data = await applyPromo(promoInput.trim());
      setPromoResult({ ok: data.success, msg: data.message });
      showToast(data.message, data.success ? 'success' : 'error');
      if (data.success) setPromoInput('');
    } catch (err: any) {
      const errorMsg = err.message || 'Ошибка активации';
      setPromoResult({ ok: false, msg: errorMsg });
      showToast(errorMsg, 'error');
    } finally {
      setPromoLoading(false);
    }
  }, [promoInput, showToast]);

  return (
    <div className="page">
      <div style={styles.headerRow}>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => {
            haptic('light');
            navigate('home');
          }}
          style={{ width: 36, height: 36 }}
        >
          <ArrowLeft size={18} />
        </button>
        <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Настройки и аккаунт</h2>
      </div>

      {/* User Profile Card */}
      {profile && (
        <div className="card card-accent" style={{ marginBottom: 16, marginTop: 16 }}>
          <div className="glow-orb" style={{ top: -30, right: -10 }} />
          <div style={styles.profileHeader}>
            <div style={styles.avatarWrapper}>
              {profile.username ? profile.username[0].toUpperCase() : <User size={24} />}
            </div>
            <div style={{ position: 'relative', zIndex: 2, flex: 1 }}>
              <div style={styles.profileName}>
                {profile.username ? `@${profile.username}` : 'Пользователь Telegram'}
              </div>
              <div style={styles.profileId}>
                ID: <span style={{ color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{profile.tg_id}</span>
              </div>
            </div>
          </div>

          {profile.discount_percent > 0 && (
            <div style={styles.discountRow}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Персональная скидка</span>
              <span className="glow-text" style={{ fontWeight: 750, fontSize: 16 }}>
                {profile.discount_percent}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Referral Program */}
      {referral && (
        <div style={{ marginBottom: 16 }}>
          <p className="section-title">
            <Gift size={15} style={{ color: 'var(--success)' }} /> Реферальная программа
          </p>
          <div className="card" style={{ padding: 16 }}>
            <p style={styles.refDesc}>
              Пригласите друга! При его первой покупке вы получите{' '}
              <strong style={{ color: 'var(--success)' }}>+5 дней</strong> бонусом к вашей подписке.
            </p>

            <div className="copy-field" style={{ margin: 0 }}>
              <code>{referral.referral_link}</code>
              <button
                className={`copy-btn ${copiedRef ? 'copied' : ''}`}
                onClick={copyRefLink}
              >
                {copiedRef ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promo Code Input */}
      <div style={{ marginBottom: 16 }}>
        <p className="section-title">
          <Tag size={15} style={{ color: 'var(--accent-primary)' }} /> Промокод
        </p>

        <div className="card" style={{ padding: 16 }}>
          <div style={styles.promoRow}>
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="Введите промокод"
              style={styles.promoInput}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleApplyPromo}
              disabled={promoLoading || !promoInput.trim()}
              style={promoLoading || !promoInput.trim() ? { opacity: 0.6 } : {}}
            >
              {promoLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Применить'}
            </button>
          </div>

          {promoResult && (
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                color: promoResult.ok ? 'var(--success)' : 'var(--danger)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {promoResult.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {promoResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Quick Navigation Menu */}
      <div style={{ marginBottom: 16 }}>
        <p className="section-title">Поддержка и справка</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            {
              icon: HelpCircle,
              label: 'Часто задаваемые вопросы (FAQ)',
              action: () => {
                haptic('light');
                navigate('faq');
              },
            },
            {
              icon: History,
              label: 'История платежей и подписок',
              action: () => {
                haptic('light');
                navigate('history');
              },
            },
            {
              icon: MessageSquare,
              label: 'Поддержка в Telegram',
              action: () => {
                haptic('light');
                tg?.openTelegramLink('https://t.me/your_support_bot');
              },
            },
          ].map((item, idx) => {
            const IconComponent = item.icon;

            return (
              <button
                key={idx}
                className="card card-interactive"
                style={styles.menuItem}
                onClick={item.action}
              >
                <div style={styles.menuIconWrapper}>
                  <IconComponent size={18} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <span style={styles.menuLabel}>{item.label}</span>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            );
          })}
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
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'var(--accent-gradient)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 800,
    color: '#ffffff',
    boxShadow: '0 4px 16px var(--accent-glow)',
    flexShrink: 0,
    position: 'relative' as const,
    zIndex: 2,
  },
  profileName: {
    fontWeight: 800,
    fontSize: 16,
    marginBottom: 2,
  },
  profileId: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  discountRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid var(--glass-border)',
    position: 'relative' as const,
    zIndex: 2,
  },
  refDesc: {
    fontSize: 13.5,
    color: 'var(--text-secondary)',
    marginBottom: 12,
    lineHeight: '1.5',
  },
  promoRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  promoInput: {
    flex: 1,
    padding: '11px 14px',
    background: 'rgba(0, 0, 0, 0.35)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    border: '1px solid var(--glass-border)',
    width: '100%',
    fontFamily: 'inherit',
    fontSize: 14,
    color: 'var(--text-primary)',
    textAlign: 'left' as const,
  },
  menuIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuLabel: {
    flex: 1,
    fontWeight: 600,
  },
};
