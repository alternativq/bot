import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import { authenticate, getMe, setAuthToken, getAuthToken } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import logoImg from '../assets/logo.jpg';
import type { UserProfile } from '../types';
import {
  ShieldCheck,
  Copy,
  Check,
  Zap,
  Settings,
  AlertTriangle,
  Search,
  Key,
  Flame,
  History,
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
      showToast('Ссылка скопирована в буфер', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Не удалось скопировать', 'error');
    }
  }, [profile, showToast]);

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
          onClick={() => {
            haptic('light');
            navigate('faq');
          }}
        >
          <Search size={18} />
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
          {sub?.active ? 'VeiloraVPN Подключение' : 'Нажмите для подписки'}
        </div>
        <div className="pulse-ring-text-sub">
          <Zap size={13} style={{ color: sub?.active ? '#ffffff' : 'var(--text-muted)' }} />
          <span>{sub?.active ? 'Нажмите, чтобы скопировать ключ в 1 клик' : 'Перейти в каталог тарифов →'}</span>
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

          {sub.sub_link && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
                onClick={() => {
                  haptic('medium');
                  navigate('subscription');
                }}
              >
                <Key size={15} />
                Подключение
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
            <ShieldCheck size={28} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 850, color: '#ffffff', marginBottom: 4 }}>
            Нет активной подписки
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Выберите тариф и получите безопасный VPN за 1 минуту
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              haptic('medium');
              navigate('plans');
            }}
          >
            <Zap size={16} />
            Выбрать тариф →
          </button>
        </div>
      )}

      {/* Noir Section Title */}
      <div className="noir-section-title">КАТАЛОГ УСЛУГ</div>

      {/* 2-Column Catalog Cards matching NOIR MARKET layout */}
      <div className="noir-grid">
        {/* Card 1: Plans */}
        <div
          className="card card-interactive"
          onClick={() => {
            haptic('light');
            navigate('plans');
          }}
        >
          <div className="noir-card-top">
            <div className="noir-card-icon-box">
              <Flame size={22} />
            </div>
            <span className="noir-badge">ХИТ</span>
          </div>

          <div className="noir-card-title">Тарифы VPN</div>
          <div className="noir-card-desc">Все подписки · От 1 месяца</div>

          <div className="noir-card-price-row">
            <span className="noir-price">от 99 ₽</span>
          </div>

          <div className="noir-card-footer">
            <span>⚡ моментальная выдача</span>
          </div>
        </div>

        {/* Card 2: My VPN */}
        <div
          className="card card-interactive"
          onClick={() => {
            haptic('light');
            navigate('subscription');
          }}
        >
          <div className="noir-card-top">
            <div className="noir-card-icon-box">
              <Key size={22} />
            </div>
            <span className="noir-badge noir-badge-dark">VPN</span>
          </div>

          <div className="noir-card-title">Моя подписка</div>
          <div className="noir-card-desc">Ключ подключения & QR-код</div>

          <div className="noir-card-price-row">
            <span className="noir-price">Ключи</span>
          </div>

          <div className="noir-card-footer">
            <span>📱 iOS / Android / PC</span>
          </div>
        </div>

        {/* Card 3: History */}
        <div
          className="card card-interactive"
          onClick={() => {
            haptic('light');
            navigate('history');
          }}
        >
          <div className="noir-card-top">
            <div className="noir-card-icon-box">
              <History size={22} />
            </div>
          </div>

          <div className="noir-card-title">История</div>
          <div className="noir-card-desc">Ваши покупки и транзакции</div>

          <div className="noir-card-price-row">
            <span className="noir-price">Отчёты</span>
          </div>

          <div className="noir-card-footer">
            <span>📜 квитанции</span>
          </div>
        </div>

        {/* Card 4: Settings / Profile */}
        <div
          className="card card-interactive"
          onClick={() => {
            haptic('light');
            navigate('settings');
          }}
        >
          <div className="noir-card-top">
            <div className="noir-card-icon-box">
              <Settings size={22} />
            </div>
            {profile && profile.discount_percent > 0 && (
              <span className="noir-badge">-{profile.discount_percent}%</span>
            )}
          </div>

          <div className="noir-card-title">Настройки</div>
          <div className="noir-card-desc">Промокоды & Бонусы</div>

          <div className="noir-card-price-row">
            <span className="noir-price">Профиль</span>
          </div>

          <div className="noir-card-footer">
            <span>🎁 рефералы</span>
          </div>
        </div>
      </div>
    </div>
  );
}
