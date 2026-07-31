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
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Настройки</h2>

      {/* Profile info */}
      {profile && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="info-row">
            <span className="label">Telegram ID</span>
            <span className="value" style={{ color: 'var(--link)', fontFamily: 'monospace' }}>
              {profile.tg_id}
            </span>
          </div>
          {profile.username && (
            <div className="info-row">
              <span className="label">Username</span>
              <span className="value">@{profile.username}</span>
            </div>
          )}
          {profile.discount_percent > 0 && (
            <div className="info-row">
              <span className="label">Активная скидка</span>
              <span className="value" style={{ color: 'var(--success)' }}>
                {profile.discount_percent}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Referral */}
      {referral && (
        <div style={{ marginBottom: 12 }}>
          <p className="section-title">🎁 Реферальная программа</p>
          <div className="card" style={{ padding: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Пригласите друга — при его первой покупке вы получите +5 дней бонусом
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
      <div style={{ marginBottom: 12 }}>
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
            >
              {promoLoading ? '...' : 'OK'}
            </button>
          </div>
          {promoResult && (
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: promoResult.ok ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {promoResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Navigation links */}
      <div style={{ marginBottom: 12 }}>
        <p className="section-title">Навигация</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className="card" style={styles.menuItem} onClick={() => navigate('faq')}>
            <span>❓ Частые вопросы</span>
            <span style={{ color: 'var(--text-secondary)' }}>→</span>
          </button>
          <button className="card" style={styles.menuItem} onClick={() => navigate('history')}>
            <span>📜 История платежей</span>
            <span style={{ color: 'var(--text-secondary)' }}>→</span>
          </button>
          <button
            className="card"
            style={styles.menuItem}
            onClick={() => {
              haptic();
              tg?.openTelegramLink('https://t.me/your_support_bot');
            }}
          >
            <span>💬 Поддержка</span>
            <span style={{ color: 'var(--text-secondary)' }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  promoRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  promoInput: {
    flex: 1,
    padding: '10px 14px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
  },
  menuItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    fontFamily: 'inherit',
    fontSize: 15,
    color: 'var(--text-primary)',
    textAlign: 'left' as const,
  },
};
