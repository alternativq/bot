import { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import {
  X,
  Copy,
  Check,
  Share2,
  Gift,
  CheckCircle2,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { tg, haptic } = useTelegram();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const websiteUrl = 'https://mindmorow.com.ru/';

  const handleCopyLink = async () => {
    haptic('medium');
    try {
      await navigator.clipboard.writeText(websiteUrl);
      setCopied(true);
      showToast('Ссылка на сайт скопирована для друга!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Ошибка копирования', 'error');
    }
  };

  const handleShareTelegram = () => {
    haptic('medium');
    const shareText = encodeURIComponent(
      '🎁 Получи бесплатный пробный доступ к VPN на 2 дня прямо на сайте без регистрации!'
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(websiteUrl)}&text=${shareText}`;

    if (tg && typeof tg.openTelegramLink === 'function') {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
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
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: 24,
          padding: '22px 18px',
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
            <span className="noir-badge" style={{ background: '#8b5cf6', color: '#ffffff', fontWeight: 900, padding: '4px 10px', fontSize: 11 }}>
              🎁 ДЛЯ ДРУЗЕЙ
            </span>
            <span style={{ fontSize: 12, fontWeight: 750, color: 'var(--text-secondary)' }}>
              Доступ без Telegram
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

        {/* Banner Title */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
          }}>
            <Gift size={28} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginBottom: 4 }}>
            Пробный период без Telegram
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Порекомендуйте VPN знакомым — они смогут получить 2 дня бесплатного доступа прямо на сайте
          </div>
        </div>

        {/* Short & Simple 3-step Instructions */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: '16px 14px',
          marginBottom: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={15} /> Простая инструкция для друга:
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#ffffff' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(139, 92, 246, 0.25)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
              1
            </div>
            <div>
              <strong>Перейти на сайт:</strong> <code style={{ color: '#c084fc', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 6 }}>mindmorow.com.ru</code>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#ffffff' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(139, 92, 246, 0.25)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
              2
            </div>
            <div>
              <strong>Ответить на пример:</strong> быстрая защита капчей от ботов
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#ffffff' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(139, 92, 246, 0.25)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
              3
            </div>
            <div>
              <strong>Нажать «Получить доступ»:</strong> ваш пробный ключ активируется мгновенно!
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: '#ffffff',
              fontWeight: 850,
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
              padding: '14px',
            }}
            onClick={handleCopyLink}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Ссылка скопирована!' : '📋 Скопировать ссылку для друга'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={{ padding: '12px' }}
            onClick={handleShareTelegram}
          >
            <Share2 size={16} />
            <span>📲 Отправить в Telegram</span>
          </button>

          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 4,
              padding: '8px'
            }}
            onClick={() => {
              haptic('light');
              onClose();
            }}
          >
            Понятно, закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
