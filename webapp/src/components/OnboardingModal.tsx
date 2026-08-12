import { useState, useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Download,
  Copy,
  Check,
  Zap,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  subLink?: string | null;
}

export function OnboardingModal({ isOpen, onClose, subLink }: OnboardingModalProps) {
  const { tg, haptic } = useTelegram();
  const { showToast } = useToast();
  const [slide, setSlide] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSlide(0);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadApp = (app: 'happ' | 'v2raytun') => {
    haptic('medium');
    const isIos = tg?.platform === 'ios' || /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = tg?.platform === 'android' || /android/i.test(navigator.userAgent);

    let url = 'https://happ.su/';
    if (app === 'happ') {
      if (isIos) url = 'https://apps.apple.com/app/id6504287215';
      else if (isAndroid) url = 'https://play.google.com/store/apps/details?id=com.happproxy';
      else url = 'https://happ.su/';
    } else if (app === 'v2raytun') {
      if (isIos) url = 'https://apps.apple.com/app/id6476628951';
      else if (isAndroid) url = 'https://play.google.com/store/apps/details?id=com.v2raytun.android';
      else url = 'https://v2raytun.com/';
    }

    if (tg && typeof tg.openLink === 'function') {
      tg.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleCopy = async () => {
    if (!subLink) {
      showToast('Сначала оформите подписку', 'error');
      return;
    }
    haptic('medium');
    try {
      await navigator.clipboard.writeText(subLink);
      setCopied(true);
      showToast('Ключ скопирован в буфер обмена!', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Ошибка копирования ключа', 'error');
    }
  };

  const nextSlide = () => {
    haptic('light');
    if (slide < 2) setSlide((s) => s + 1);
    else onClose();
  };

  const prevSlide = () => {
    haptic('light');
    if (slide > 0) setSlide((s) => s - 1);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: 'rgba(5, 5, 8, 0.88)',
        backdropFilter: 'blur(24px) saturate(200%)',
        WebkitBackdropFilter: 'blur(24px) saturate(200%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 14px',
        animation: 'modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'radial-gradient(135deg, rgba(26, 26, 35, 0.95) 0%, rgba(12, 12, 16, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: 24,
          padding: '20px 18px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="noir-badge" style={{ background: '#ffffff', color: '#000000', fontWeight: 900, padding: '4px 10px', fontSize: 11 }}>
              ШАГ {slide + 1} ИЗ 3
            </span>
            <span style={{ fontSize: 12, fontWeight: 750, color: 'var(--text-secondary)' }}>
              {slide === 0 ? 'Установка клиента' : slide === 1 ? 'Копирование ключа' : 'Активация в 1 клик'}
            </span>
          </div>

          <button
            className="noir-icon-btn"
            style={{ width: 32, height: 32, borderRadius: 10 }}
            onClick={() => {
              haptic('light');
              onClose();
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress Bar Dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              onClick={() => {
                haptic('light');
                setSlide(idx);
              }}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 99,
                background: idx <= slide ? '#ffffff' : 'rgba(255, 255, 255, 0.12)',
                boxShadow: idx === slide ? '0 0 10px rgba(255, 255, 255, 0.6)' : 'none',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        {/* Slide Content */}
        {slide === 0 && (
          <div style={{ animation: 'slideIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: '#ffffff',
                }}
              >
                <Download size={28} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginBottom: 6 }}>
                Установите VPN-клиент
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Для работы VeiloraVPN выберите одно из двух рекомендованных приложений:
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {/* Happ Client */}
              <div
                className="card"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '14px 14px',
                  borderRadius: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={18} style={{ color: 'var(--success)' }} />
                    <span style={{ fontSize: 15, fontWeight: 850, color: '#ffffff' }}>Happ</span>
                  </div>
                  <span className="noir-badge" style={{ background: 'var(--success)', color: '#ffffff', fontSize: 10 }}>РЕКОМЕНДУЕМ</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.35, marginBottom: 10 }}>
                  Подходит для iOS, Android и Windows. Поддерживает авто-запуск и высокую скорость.
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block btn-sm"
                  style={{ fontSize: 12, padding: '8px 12px' }}
                  onClick={() => handleDownloadApp('happ')}
                >
                  <Download size={14} /> Скачать Happ
                </button>
              </div>

              {/* v2raytun Client */}
              <div
                className="card"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '14px 14px',
                  borderRadius: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={18} style={{ color: '#ffffff' }} />
                    <span style={{ fontSize: 15, fontWeight: 850, color: '#ffffff' }}>v2raytun</span>
                  </div>
                  <span className="noir-badge noir-badge-dark" style={{ fontSize: 10 }}>iOS / Android / Win</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.35, marginBottom: 10 }}>
                  Универсальный клиент для защиты трафика и стабильного подключения.
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-block btn-sm"
                  style={{ fontSize: 12, padding: '8px 12px' }}
                  onClick={() => handleDownloadApp('v2raytun')}
                >
                  <Download size={14} /> Скачать v2raytun
                </button>
              </div>
            </div>
          </div>
        )}

        {slide === 1 && (
          <div style={{ animation: 'slideIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: '#ffffff',
                }}
              >
                <Copy size={28} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginBottom: 6 }}>
                Скопируйте ваш ключ
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Нажмите на кнопку ниже — ссылка подписки автоматически сохранится в буфер обмена:
              </div>
            </div>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid var(--glass-border)',
                borderRadius: 16,
                padding: 14,
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
                Ваша персональная ссылка
              </div>
              <code
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: '#ffffff',
                  wordBreak: 'break-all',
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 8,
                }}
              >
                {subLink ? `${subLink.slice(0, 36)}...` : 'Сначала активируйте подписку'}
              </code>
            </div>

            <button
              className="btn btn-primary btn-block"
              style={{
                padding: '14px',
                fontSize: 14,
                background: copied ? 'var(--success)' : '#ffffff',
                color: '#000000',
                marginBottom: 18,
                boxShadow: copied ? '0 4px 20px rgba(16, 185, 129, 0.4)' : '0 4px 20px rgba(255, 255, 255, 0.3)',
              }}
              onClick={handleCopy}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              <span>{copied ? 'Ключ скопирован!' : 'Скопировать ключ подписки'}</span>
            </button>
          </div>
        )}

        {slide === 2 && (
          <div style={{ animation: 'slideIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: '#ffffff',
                }}
              >
                <Smartphone size={28} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginBottom: 6 }}>
                Вставьте ключ и включайте VPN!
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Всего 3 простых действия внутри приложения Happ или v2raytun:
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: 14 }}>
                <span className="noir-badge" style={{ background: '#ffffff', color: '#000000', fontWeight: 900, width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  1
                </span>
                <div style={{ fontSize: 13, color: '#ffffff', fontWeight: 700 }}>
                  Откройте <strong>Happ</strong> или <strong>v2raytun</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: 14 }}>
                <span className="noir-badge" style={{ background: '#ffffff', color: '#000000', fontWeight: 900, width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  2
                </span>
                <div style={{ fontSize: 13, color: '#ffffff', fontWeight: 700 }}>
                  Нажмите <strong>«+»</strong> → <strong>«Import from Clipboard»</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: 14 }}>
                <span className="noir-badge" style={{ background: 'var(--success)', color: '#ffffff', fontWeight: 900, width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  3
                </span>
                <div style={{ fontSize: 13, color: '#ffffff', fontWeight: 700 }}>
                  Нажмите главный тумблер для старта VPN 🚀
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {slide > 0 ? (
            <button
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px', fontSize: 13 }}
              onClick={prevSlide}
            >
              <ChevronLeft size={16} />Назад
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px', fontSize: 13, opacity: 0.5 }}
              onClick={onClose}
            >
              Закрыть
            </button>
          )}

          <button
            className="btn btn-primary"
            style={{ flex: 2, padding: '12px', fontSize: 13 }}
            onClick={nextSlide}
          >
            <span>{slide === 2 ? 'Завершить 🚀' : 'Далее'}</span>
            {slide < 2 && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
