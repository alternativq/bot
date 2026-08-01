import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { getMe, getReferral, applyPromo } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import type { ReferralInfo, UserProfile } from '../types';

interface SettingsPageProps {
  navigate: (page: Page) => void;
}

export function SettingsPage({ navigate }: SettingsPageProps) {
  const { tg, haptic, showBackButton, hideBackButton } = useTelegram();
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
      haptic('medium');
      setTimeout(() => setCopiedRef(false), 2000);
    } catch {
      /* not available */
    }
  }, [referral, haptic]);

  const handleApplyPromo = useCallback(async () => {
    if (!promoInput.trim()) return;
    haptic();
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const data = await applyPromo(promoInput.trim());
      setPromoResult({ ok: data.success, msg: data.message });
      if (data.success) setPromoInput('');
    } catch (err: any) {
      setPromoResult({ ok: false, msg: err.message || 'Ошибка' });
    } finally {
      setPromoLoading(false);
    }
  }, [promoInput, haptic]);

  return (
    <div className="page">
      <h2 style={styles.pageTitle}>Настройки</h2>

      {/* Profile info */}
      {profile && (
        <div className="card card-accent" style={{ marginBottom: 16 }}>
          <div className="glow-orb" style={{ top: -40, right: -20 }} />
          <div style={styles.profileHeader}>
            <div style={styles.avatar}>
              {profile.username ? profile.username[0].toUpperCase() : '👤'}
            </div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={styles.profileName}>
                {profile.username ? `@${profile.username}` : 'Пользователь'}
              </div>
              <div style={styles.profileId}>
                ID: <span style={{ color: 'var(--link)', fontFamily: 'monospace' }}>{profile.tg_id}</span>
              </div>
            </div>
          </div>
          {profile.discount_percent > 0 && (
            <div style={styles.discountRow}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Скидка</span>
              <span className="glow-text" style={{ fontWeight: 700, fontSize: 16 }}>
                {profile.discount_percent}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Referral */}
      {referral && (
        <div style={{ marginBottom: 16 }}>
          <p className="section-title">🎁 Реферальная программа</p>
          <div className="card" style={{ padding: 16 }}>
            <p style={styles.refDesc}>
              Пригласите друга — при его первой покупке вы получите <strong style={{ color: 'var(--success)' }}>+5 дней</strong> бонусом
            </p>
            <div className="copy-field" style={{ margin: 0 }}>
              <code>{referral.referral_link}</code>
              <button
                className={`copy-btn ${copiedRef ? 'copied' : ''}`}
                onClick={copyRefLink}
              >
                {copiedRef ? '✓' : '📋'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promo code input */}
      <div style={{ marginBottom: 16 }}>
        <p className="section-title">🏷️ Промокод</p>
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
              style={promoLoading || !promoInput.trim() ? { opacity: 0.5 } : {}}
            >
              {promoLoading ? '...' : 'OK'}
            </button>
          </div>
          {promoResult && (
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                color: promoResult.ok ? 'var(--success)' : 'var(--danger)',
                fontWeight: 600,
              }}
            >
              {promoResult.ok ? '✓ ' : '✗ '}{promoResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Navigation links */}
      <div style={{ marginBottom: 16 }}>
        <p className="section-title">Навигация</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { icon: '❓', label: 'Частые вопросы', action: () => navigate('faq') },
            { icon: '📜', label: 'История платежей', action: () => navigate('history') },
            {
              icon: '💬',
              label: 'Поддержка',
              action: () => {
                haptic();
                tg?.openTelegramLink('https://t.me/your_support_bot');
              },
            },
          ].map((item, idx) => (
            <button
              key={idx}
              className="card"
              style={styles.menuItem}
              onClick={item.action}
            >
              <div style={styles.menuIcon}>{item.icon}</div>
              <span style={styles.menuLabel}>{item.label}</span>
              <span style={styles.menuArrow}>→</span>
            </button>
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
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'var(--gradient-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
    boxShadow: '0 4px 16px rgba(124, 108, 240, 0.3)',
    flexShrink: 0,
    position: 'relative' as const,
    zIndex: 2,
  },
  profileName: {
    fontWeight: 700,
    fontSize: 17,
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
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid var(--divider)',
    position: 'relative' as const,
    zIndex: 2,
  },
  refDesc: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 14,
    lineHeight: '1.5',
  },
  promoRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  promoInput: {
    flex: 1,
    padding: '12px 16px',
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    fontFamily: 'inherit',
    fontSize: 15,
    color: 'var(--text-primary)',
    textAlign: 'left' as const,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  },
  menuLabel: {
    flex: 1,
    fontWeight: 600,
  },
  menuArrow: {
    color: 'var(--text-secondary)',
    fontSize: 16,
  },
};
