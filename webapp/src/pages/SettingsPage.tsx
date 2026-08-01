import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { getMe, getReferral, applyPromo } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import type { ReferralInfo, UserProfile } from '../types';
import {
  User,
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
        <div style={{ fontSize: 18, fontWeight: 850, color: '#ffffff' }}>Профиль & Настройки</div>
      </div>

      {/* User Profile */}
      {profile && (
        <div className="card card-accent" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: '#ffffff', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900 }}>
              {profile.username ? profile.username[0].toUpperCase() : <User size={22} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 850, color: '#ffffff', marginBottom: 2 }}>
                {profile.username ? `@${profile.username}` : 'Пользователь Telegram'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                ID: <span style={{ fontFamily: 'JetBrains Mono', color: '#ffffff' }}>{profile.tg_id}</span>
              </div>
            </div>
          </div>

          {profile.discount_percent > 0 && (
            <div className="info-row" style={{ marginTop: 12, paddingTop: 12 }}>
              <span className="label">Персональная скидка</span>
              <span className="noir-badge">-{profile.discount_percent}%</span>
            </div>
          )}
        </div>
      )}

      {/* Referral */}
      {referral && (
        <div style={{ marginBottom: 18 }}>
          <div className="noir-section-title">Р Е Ф Е Р А Л Ь Н А Я  П Р О Г Р А М М А</div>

          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.45 }}>
              Пригласите друга! При его первой покупке вы получите <strong style={{ color: '#ffffff' }}>+5 дней</strong> бонусом.
            </div>

            <div className="copy-field" style={{ margin: 0 }}>
              <code>{referral.referral_link}</code>
              <button
                className={`copy-btn ${copiedRef ? 'copied' : ''}`}
                onClick={copyRefLink}
              >
                {copiedRef ? <Check size={14} /> : <Copy size={14} />}
                {copiedRef ? '✓' : 'Копия'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promo */}
      <div style={{ marginBottom: 18 }}>
        <div className="noir-section-title">П Р О М О К О Д</div>

        <div className="card">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="Введите промокод"
              style={{
                flex: 1,
                padding: '10px 14px',
                background: '#09090b',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-sm)',
                color: '#ffffff',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleApplyPromo}
              disabled={promoLoading || !promoInput.trim()}
            >
              {promoLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Применить'}
            </button>
          </div>

          {promoResult && (
            <div style={{ marginTop: 10, fontSize: 13, color: promoResult.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              {promoResult.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {promoResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Support Nav */}
      <div className="noir-section-title">Н А В И Г А Ц И Я  И  С П Р А В К А</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            label: 'История транзакций',
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
            <div
              key={idx}
              className="card card-interactive"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}
              onClick={item.action}
            >
              <div className="noir-card-icon-box" style={{ width: 38, height: 38, borderRadius: 12 }}>
                <IconComponent size={18} />
              </div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 750, color: '#ffffff' }}>
                {item.label}
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
