import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { authenticate, getMe, setAuthToken, getAuthToken, activateTrial } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import logoImg from '../assets/logo.webp';
import type { UserProfile } from '../types';
import { OnboardingModal } from '../components/OnboardingModal';
import {
  ShieldCheck,
  Copy,
  Check,
  Zap,
  AlertTriangle,
  HelpCircle,
  Key,
  ChevronRight,
  Sparkles,
  Gift,
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
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);

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
      showToast('Ссылка скопирована в буфер', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Не удалось скопировать', 'error');
    }
  }, [profile, showToast]);

  const handleActivateTrial = useCallback(async () => {
    setTrialLoading(true);
    haptic('heavy');
    try {
      await activateTrial();
      showToast('🎉 Пробный период успешно активирован!', 'success');
      const updated = await getMe();
      setProfile(updated);
    } catch (err: any) {
      showToast(err.message || 'Не удалось активировать триал', 'error');
    } finally {
      setTrialLoading(false);
    }
  }, [haptic, showToast]);

  if (loading) {
    return (
      <div className="page">
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 150, height: 38, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
        </div>
        <div className="skeleton" style={{ height: 26, marginBottom: 20, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 180, marginBottom: 20, borderRadius: 20 }} />
        <div className="noir-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 170, borderRadius: 20 }} />
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
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      </div>
    );
  }

  const sub = profile?.subscription;
  const firstName = user?.first_name || profile?.username || 'USER';

  return (
    <div className="page">
      {/* Noir Top Header */}
      <div className="noir-header">
        <div className="noir-header-left">
          <div className="noir-logo-box">
            <img src={logoImg} alt="VeiloraVPN" style={{ width: '100%', height: '100%', borderRadius: 14, objectFit: 'cover' }} />
          </div>
          <div>
            <div className="noir-header-title">VEILORA VPN</div>
            <div className="noir-header-sub">ПОЛЬЗОВАТЕЛЬ · {firstName.toUpperCase()}</div>
          </div>
        </div>

        <button
          className="noir-icon-btn"
          style={{ width: 'auto', padding: '0 12px', gap: 6 }}
          onClick={() => {
            haptic('light');
            navigate('faq');
          }}
        >
          <HelpCircle size={18} />
          <span style={{ fontSize: 12, fontWeight: 800 }}>FAQ</span>
        </button>
      </div>

      {/* Marquee Running Ticker */}
      <div className="noir-ticker-container">
        <div className="noir-ticker-track">
          {[1, 2].map((k) => (
            <span key={k} className="noir-ticker-item">
              ✦ ПРЕМИАЛЬНЫЙ VPN + БЕЗЛИМИТНЫЙ ТРАФИК + МГНОВЕННАЯ ВЫДАЧА + 1000 МБ/С СКОРОСТЬ ✦
            </span>
          ))}
        </div>
      </div>

      {/* Ultra-Luxury Cyber Shield Connection Widget */}
      <div
        className="pulse-ring-wrapper"
        onClick={() => {
          haptic('heavy');
          if (sub?.sub_link) {
            copyLink();
          } else {
            navigate('plans');
          }
        }}
      >
        <div className={`pulse-ring-status-badge ${sub?.active ? 'active' : 'inactive'}`}>
          ● {sub?.active ? 'ЗАЩИТА АКТИВНА · 1000 МБ/С' : 'ОТКЛЮЧЕНО · НЕТ ПОДПИСКИ'}
        </div>

        <div className={`pulse-ring-outer ${sub?.active ? 'pulse-ring-active' : 'pulse-ring-inactive'}`}>
          {sub?.active && <div className="pulse-ring-wave" />}
          <div className="pulse-ring-inner">
            <ShieldCheck size={46} style={{ color: sub?.active ? '#ffffff' : '#ef4444' }} />
          </div>
        </div>

        <div className="pulse-ring-text-main">
          {sub?.active ? 'VeiloraVPN Активен' : 'Подключить VPN'}
        </div>
        <div className="pulse-ring-text-sub">
          <Zap size={13} style={{ color: sub?.active ? '#ffffff' : 'var(--text-muted)' }} />
          <span>{sub?.active ? '📋 Нажмите, чтобы скопировать ключ в 1 клик' : '🔥 Выбрать тариф и подключить за 1 мин →'}</span>
        </div>
      </div>

      {/* 30-Second Quick Onboarding Banner */}
      <div
        className="card card-interactive"
        style={{
          marginBottom: 18,
          background: 'radial-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(13, 13, 16, 0.96) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
        onClick={() => {
          haptic('medium');
          setShowOnboardingModal(true);
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#ffffff', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(255, 255, 255, 0.3)' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>👋 Как настроить за 30 секунд</span>
                <span className="noir-badge" style={{ background: 'var(--success)', color: '#ffffff', fontSize: 9 }}>ГИД</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Пошаговая инструкция: Happ / v2raytun</div>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: '#ffffff' }} />
        </div>
      </div>

      {/* Subscription Active Banner */}
      {sub ? (
        <div className="card card-accent" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 850, color: '#ffffff', marginBottom: 6 }}>
                {sub.plan_title}
              </div>
              <span
                className="noir-badge"
                style={{
                  background: sub.active ? 'var(--success)' : 'rgba(239, 68, 68, 0.2)',
                  color: '#ffffff',
                  border: sub.active ? 'none' : '1px solid var(--danger)',
                  boxShadow: sub.active ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
                }}
              >
                {sub.active ? '● АКТИВНА' : '● ИСТЕКЛА'}
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                {sub.days_left}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                дней осталось
              </div>
            </div>
          </div>

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
            <span className="value">{sub.limit_ip ? `${sub.limit_ip} шт.` : 'Безлимит'}</span>
          </div>

          {/* Visual Subscription Progress Bar */}
          {(() => {
            const totalDays = sub.total_days || (sub.days_left > 30 ? 90 : 30);
            const percent = Math.min(100, Math.max(0, Math.round((sub.days_left / totalDays) * 100)));
            const progressColor = sub.days_left <= 3 ? '#ef4444' : sub.days_left <= 7 ? '#f59e0b' : '#10b981';
            return (
              <div style={{ marginTop: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 750, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  <span>Прогресс подписки</span>
                  <span style={{ color: progressColor, fontWeight: 850 }}>
                    {sub.days_left} дн. ({percent}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${percent}%`,
                      borderRadius: 999,
                      background: sub.days_left <= 3
                        ? 'linear-gradient(90deg, #ef4444, #f87171)'
                        : sub.days_left <= 7
                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                        : 'linear-gradient(90deg, #10b981, #34d399)',
                      boxShadow: `0 0 10px ${progressColor}`,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Fast renewal button for users with <= 7 days or expired sub */}
          {(sub.days_left <= 7 || !sub.active) && (
            <button
              className="btn btn-primary btn-block"
              style={{
                marginTop: 14,
                marginBottom: 10,
                background: sub.days_left <= 3
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                fontWeight: 850,
                boxShadow: sub.days_left <= 3
                  ? '0 8px 24px rgba(239, 68, 68, 0.4)'
                  : '0 8px 24px rgba(245, 158, 11, 0.35)',
              }}
              onClick={() => {
                haptic('medium');
                navigate('plans');
              }}
            >
              <Zap size={16} />
              <span>⚡ Продлить подписку ({sub.days_left === 0 ? 'Истекла' : `Осталось ${sub.days_left} дн.`}) →</span>
            </button>
          )}

          {sub.sub_link && (
            <div style={{ display: 'flex', gap: 8, marginTop: (sub.days_left <= 7 || !sub.active) ? 0 : 14 }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
                onClick={() => {
                  haptic('medium');
                  navigate('subscription');
                }}
              >
                <Key size={15} />
                Ключ и Инструкция
              </button>
              <button
                className="copy-btn"
                onClick={copyLink}
                style={copied ? { background: 'var(--success)', color: '#ffffff' } : {}}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card card-accent" style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: '#ffffff', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            {profile?.trial_enabled && !profile?.trial_used ? <Gift size={28} /> : <ShieldCheck size={28} />}
          </div>
          <div style={{ fontSize: 18, fontWeight: 850, color: '#ffffff', marginBottom: 4 }}>
            {profile?.trial_enabled && !profile?.trial_used ? 'Попробуйте VeiloraVPN бесплатно' : 'Нет активной подписки'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {profile?.trial_enabled && !profile?.trial_used
              ? 'Вам доступен бесплатный пробный период на 2 дня без привязки карты'
              : 'Выберите тариф и получите безопасный VPN за 1 минуту'}
          </div>

          {profile?.trial_enabled && !profile?.trial_used ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary btn-block"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
                  color: '#000000',
                  fontWeight: 850,
                  boxShadow: '0 8px 24px rgba(255, 255, 255, 0.3)',
                }}
                disabled={trialLoading}
                onClick={handleActivateTrial}
              >
                <Gift size={16} />
                <span>{trialLoading ? 'Активация...' : '🎁 Попробовать бесплатно (2 дня) →'}</span>
              </button>

              <button
                className="btn btn-secondary btn-block"
                onClick={() => {
                  haptic('medium');
                  navigate('plans');
                }}
              >
                <Zap size={16} />
                <span>Выбрать платный тариф (от 99 ₽) →</span>
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                haptic('medium');
                navigate('plans');
              }}
            >
              <Zap size={16} />
              Выбрать тариф (от 99 ₽) →
            </button>
          )}
        </div>
      )}



      {/* Full-Screen Interactive Onboarding Modal Wizard */}
      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        subLink={sub?.sub_link}
      />
    </div>
  );
}
