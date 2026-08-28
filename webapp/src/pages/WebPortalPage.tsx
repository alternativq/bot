import React, { useState, useEffect } from 'react';

interface WebConfig {
  brand_name: string;
  bot_username: string;
  web_trial_enabled: boolean;
  trial_duration_days: number;
}

interface CaptchaData {
  captcha_id: string;
  question: string;
}

interface TrialResult {
  public_token: string;
  sub_link: string;
  happ_link: string;
  v2raytun_link: string;
  tg_link: string;
  qr_code: string;
  period_end: string;
  duration_days: number;
}

export function WebPortalPage() {
  const [config, setConfig] = useState<WebConfig | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrialResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Mode State: 'trial' vs 'recover'
  const [mode, setMode] = useState<'trial' | 'recover'>('trial');
  const [recoverToken, setRecoverToken] = useState('');

  // Pro / Simple Mode Switcher (default: false -> Simple mode)
  const [isAdvanced, setIsAdvanced] = useState<boolean>(() => {
    return localStorage.getItem('veilora_web_mode') === 'advanced';
  });

  const toggleMode = (advanced: boolean) => {
    setIsAdvanced(advanced);
    localStorage.setItem('veilora_web_mode', advanced ? 'advanced' : 'simple');
  };

  useEffect(() => {
    fetchConfig();
    fetchCaptcha();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch('/api/v1/web/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.error('Failed to load web config', e);
    }
  }

  async function fetchCaptcha() {
    try {
      const res = await fetch('/api/v1/web/captcha');
      if (res.ok) {
        const data = await res.json();
        setCaptcha(data);
        setAnswer('');
      }
    } catch (e) {
      console.error('Failed to load captcha', e);
    }
  }

  async function handleGetTrial(e: React.FormEvent) {
    e.preventDefault();
    if (!captcha || !answer.trim()) {
      setError('Ответьте на проверочный вопрос');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const deviceToken = localStorage.getItem('veilora_trial_token') || '';

    try {
      const res = await fetch('/api/v1/web/free-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captcha_id: captcha.captcha_id,
          answer: answer.trim(),
          device_token: deviceToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка получения конфигурации');
      }

      if (data.public_token) {
        localStorage.setItem('veilora_trial_token', data.public_token);
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
      fetchCaptcha(); // reload captcha on error
    } finally {
      setLoading(false);
    }
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    if (!recoverToken.trim()) {
      setError('Введите токен конфигурации');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/v1/web/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recoverToken.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Профиль не найден');
      }

      if (data.public_token) {
        localStorage.setItem('veilora_trial_token', data.public_token);
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка восстановления');
    } finally {
      setLoading(false);
    }
  }

  const copyToClipboard = (text: string, isToken: boolean = false) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    if (isToken) {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnectClick = (appUrl: string, subUrl: string) => {
    copyToClipboard(subUrl);
    setToastMessage('📋 Ссылка подписки скопирована в буфер обмена!');
    setTimeout(() => setToastMessage(null), 3000);

    setTimeout(() => {
      window.location.href = appUrl;
    }, 100);
  };

  const rawBrand = config?.brand_name || 'Veilora';
  const brandName = rawBrand.replace(/VPN/gi, '').trim() || 'Veilora';

  return (
    <div className="page" style={{ paddingTop: 16, paddingBottom: 36, maxWidth: 460, margin: '0 auto', paddingLeft: 14, paddingRight: 14 }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: '#10b981',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: 20,
          fontWeight: 800,
          fontSize: 13,
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
          textAlign: 'center',
          maxWidth: '90%'
        }}>
          {toastMessage}
        </div>
      )}

      {/* SHARE MODAL FOR FRIENDS */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#13131a',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: 22,
            padding: 22,
            maxWidth: 420,
            width: '100%',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>
                🤝 Как поделиться с друзьями
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 14 }}>
              Вашим знакомым <strong>не нужен Telegram-бот</strong> для получения пробного периода! Они могут сделать это за 10 секунд прямо на сайте:
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: 14,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981', marginBottom: 10, textTransform: 'uppercase' }}>
                💡 Понятная инструкция для друга:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#e5e7eb' }}>
                <div><strong>1. Перейдите на сайт:</strong> <code>mindmorow.com.ru</code></div>
                <div><strong>2. Решите пример:</strong> укажите простой ответ на математическую капчу</div>
                <div><strong>3. Нажмите «Получить доступ»:</strong> ваш пробный ключ активируется мгновенно!</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                copyToClipboard('https://mindmorow.com.ru/');
                setToastMessage('📋 Ссылка сайта для друзей скопирована!');
                setTimeout(() => setToastMessage(null), 3000);
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(139, 92, 246, 0.4)',
                marginBottom: 10
              }}
            >
              📋 Скопировать ссылку для отправки другу
            </button>

            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Понятно, закрыть
            </button>
          </div>
        </div>
      )}

      {/* MODE TOGGLE SWITCH (SIMPLE vs PRO) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 25,
          padding: 3,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
        }}>
          <button
            type="button"
            onClick={() => toggleMode(false)}
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              border: 'none',
              background: !isAdvanced ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
              color: !isAdvanced ? '#ffffff' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: !isAdvanced ? '0 2px 10px rgba(16, 185, 129, 0.35)' : 'none'
            }}
          >
            🌱 Простой режим
          </button>
          <button
            type="button"
            onClick={() => toggleMode(true)}
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              border: 'none',
              background: isAdvanced ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : 'transparent',
              color: isAdvanced ? '#ffffff' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: isAdvanced ? '0 2px 10px rgba(139, 92, 246, 0.35)' : 'none'
            }}
          >
            ⚙️ PRO режим
          </button>
        </div>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: 16,
          background: isAdvanced 
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(255, 255, 255, 0.05) 100%)'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(255, 255, 255, 0.05) 100%)',
          border: isAdvanced ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 10px',
          fontSize: 26,
          boxShadow: isAdvanced ? '0 8px 24px rgba(139, 92, 246, 0.25)' : '0 8px 24px rgba(16, 185, 129, 0.25)',
          transition: 'all 0.3s ease'
        }}>
          {isAdvanced ? '⚙️' : '⚡'}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#ffffff' }}>
          {brandName}
        </h1>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, padding: '0 8px', lineHeight: 1.35 }}>
          {isAdvanced 
            ? 'Расширенная панель управления сетевым профилем' 
            : 'Персональный безопасный доступ'}
        </p>
      </div>

      {/* BUTTON: SHARE WITH FRIENDS */}
      <button
        type="button"
        onClick={() => setShowShareModal(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: '100%',
          padding: '9px 12px',
          background: 'rgba(139, 92, 246, 0.12)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 14,
          color: '#c084fc',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 14,
          transition: 'all 0.2s'
        }}
      >
        🤝 Как поделиться с друзьями без Telegram?
      </button>

      {/* Navigation Tabs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 6,
        padding: 4,
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 14,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: 16
      }}>
        <button
          type="button"
          onClick={() => { setMode('trial'); setError(null); }}
          style={{
            padding: '10px 10px',
            borderRadius: 10,
            border: 'none',
            background: mode === 'trial' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
            color: mode === 'trial' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: 42
          }}
        >
          ✨ {isAdvanced ? 'Новый профиль' : 'Получить доступ'}
        </button>
        <button
          type="button"
          onClick={() => { setMode('recover'); setError(null); }}
          style={{
            padding: '10px 10px',
            borderRadius: 10,
            border: 'none',
            background: mode === 'recover' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
            color: mode === 'recover' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: 42
          }}
        >
          🔍 {isAdvanced ? 'Поиск профиля' : 'Мой ключ'}
        </button>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 14,
          color: '#f87171',
          fontSize: 13,
          marginBottom: 16,
          lineHeight: 1.45
        }}>
          <div>⚠️ {error}</div>
          {(error.includes('получен') || error.includes('недоступно')) && (
            <button
              onClick={() => {
                setMode('recover');
                const saved = localStorage.getItem('veilora_trial_token');
                if (saved) setRecoverToken(saved);
              }}
              style={{
                marginTop: 10,
                padding: '8px 14px',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 10,
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
                minHeight: 40
              }}
            >
              🔍 Найти ранее созданный профиль
            </button>
          )}
        </div>
      )}

      {/* RESULT VIEW */}
      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* SIMPLIFIED RESULT VIEW (Default) */}
          {!isAdvanced ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(19, 19, 24, 0.9) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 18,
              padding: 18,
              boxShadow: '0 12px 30px rgba(0,0,0,0.45)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 36, marginBottom: 4 }}>🎉</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>
                  Подключение создано!
                </h3>
                <p style={{ fontSize: 12, color: '#a7f3d0', margin: 0 }}>
                  Пробный период активен до {new Date(result.period_end).toLocaleDateString('ru-RU')}
                </p>
              </div>

              {/* 1-Click Connect Button */}
              <button
                type="button"
                onClick={() => handleConnectClick(result.v2raytun_link, result.sub_link)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '16px 12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 800,
                  borderRadius: 14,
                  border: 'none',
                  textAlign: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
                  marginBottom: 10,
                  minHeight: 52
                }}
              >
                🚀 Подключить (скопировать ссылку)
              </button>

              {/* Copy Link Directly Button */}
              <button
                type="button"
                onClick={() => copyToClipboard(result.sub_link)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px',
                  background: copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: copied ? '#34d399' : '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 12,
                  textAlign: 'center',
                  cursor: 'pointer',
                  marginBottom: 10,
                  minHeight: 44
                }}
              >
                {copied ? '✓ Ссылка скопирована!' : '📋 Скопировать ссылку подписки'}
              </button>

              {result.tg_link && (
                <a
                  href={result.tg_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '12px',
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    color: '#c084fc',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 12,
                    textAlign: 'center',
                    textDecoration: 'none',
                    marginBottom: 10,
                    minHeight: 44
                  }}
                >
                  💬 Привязать к Telegram-боту
                </a>
              )}

              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => toggleMode(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  ⚙️ Нужен QR-код или прямой токен? PRO режим
                </button>
              </div>
            </div>
          ) : (

            /* ADVANCED PRO RESULT VIEW */
            <div style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(19, 19, 24, 0.9) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              borderRadius: 18,
              padding: 18,
              boxShadow: '0 12px 30px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>⚙️</span>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#fff' }}>
                      Параметры подписки (PRO)
                    </h3>
                    <p style={{ fontSize: 11, color: '#c084fc', margin: 0 }}>
                      До {new Date(result.period_end).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
                  fontSize: 10,
                  fontWeight: 800
                }}>
                  ACTIVE
                </span>
              </div>

              {/* Public Token Info */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                padding: 10,
                marginBottom: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Публичный токен (Public Token)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.public_token, true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: tokenCopied ? '#34d399' : '#c084fc',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {tokenCopied ? '✓ Скопировано' : 'Скопировать токен'}
                  </button>
                </div>
                <code style={{ fontSize: 11, color: '#f3f4f6', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {result.public_token}
                </code>
              </div>

              {/* Subscription Link */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Ссылка подписки (Unified Sub URL)
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    readOnly
                    value={result.sub_link}
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      padding: '8px 10px',
                      color: '#fff',
                      fontSize: 11,
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.sub_link)}
                    style={{
                      background: copied ? 'var(--success)' : '#ffffff',
                      color: copied ? '#ffffff' : '#000000',
                      border: 'none',
                      borderRadius: 10,
                      padding: '0 12px',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {copied ? '✓' : 'Копировать'}
                  </button>
                </div>
              </div>

              {/* Quick Launch Protocol Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => handleConnectClick(result.v2raytun_link, result.sub_link)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: 12,
                    padding: '10px',
                    borderRadius: 12,
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontWeight: 700,
                    minHeight: 40
                  }}
                >
                  ⚡ v2raytun Protocol
                </button>
                <button
                  type="button"
                  onClick={() => handleConnectClick(result.happ_link, result.sub_link)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: 12,
                    padding: '10px',
                    borderRadius: 12,
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontWeight: 700,
                    minHeight: 40
                  }}
                >
                  📱 Happ Protocol
                </button>
              </div>

              {/* Toggle QR Code */}
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 10,
                  cursor: 'pointer',
                  padding: '8px 0',
                  marginBottom: 10
                }}
              >
                {showQr ? '▲ Скрыть QR-код' : '📷 Показать QR-код импорта'}
              </button>

              {showQr && (
                <div style={{ textAlign: 'center', marginTop: 6, padding: 12, background: '#fff', borderRadius: 14, marginBottom: 12 }}>
                  <img src={result.qr_code} alt="QR Code" style={{ width: 160, height: 160, display: 'block', margin: '0 auto 8px' }} />
                  <a
                    href={result.qr_code}
                    download="veilora-qr.png"
                    style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      background: '#111827',
                      color: '#ffffff',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    💾 Скачать QR (PNG)
                  </a>
                </div>
              )}

              {/* Telegram Link */}
              {result.tg_link && (
                <a
                  href={result.tg_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '11px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    borderRadius: 12,
                    textAlign: 'center',
                    textDecoration: 'none',
                    minHeight: 42
                  }}
                >
                  💬 Авторизовать в Telegram
                </a>
              )}
            </div>
          )}

          {/* RESET / NEW REQUEST BUTTON */}
          <button
            type="button"
            onClick={() => { setResult(null); fetchCaptcha(); }}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--text-secondary)',
              padding: '10px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              marginTop: 2,
              minHeight: 42
            }}
          >
            ← Вернуться назад
          </button>
        </div>
      ) : mode === 'trial' ? (

        /* FORM: GET TRIAL */
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
          borderRadius: 18,
          padding: 18,
          backdropFilter: 'var(--glass-blur)'
        }}>
          {/* Form Header */}
          <div style={{ marginBottom: 14 }}>
            <span style={{
              display: 'inline-block',
              padding: '3px 8px',
              borderRadius: 20,
              background: !isAdvanced ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.2)',
              border: !isAdvanced ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
              color: !isAdvanced ? '#34d399' : '#c084fc',
              fontSize: 10,
              fontWeight: 800,
              marginBottom: 6
            }}>
              {isAdvanced ? '⚙️ PRO ТАРИФ: TRIAL' : '🌱 ПРОСТОЙ ДОСТУП'}
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>
              {isAdvanced 
                ? `Генерация подписки (${config?.trial_duration_days || 2} дн.)` 
                : `Получить доступ`}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {isAdvanced 
                ? 'Формирование протокола с автоматической выдачей токена.'
                : 'Нажмите кнопку ниже для получения подключения.'}
            </p>
          </div>

          <form onSubmit={handleGetTrial}>
            {/* CAPTCHA PUZZLE BOX */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 14
            }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                🛡 Проверка безопасности:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', minWidth: 100 }}>
                  {captcha ? captcha.question : 'Загрузка...'}
                </span>
                <input
                  type="number"
                  placeholder="Ответ"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: 15,
                    outline: 'none',
                    minHeight: 40
                  }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !captcha}
              style={{
                width: '100%',
                padding: '14px 10px',
                background: !isAdvanced ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#ffffff',
                color: !isAdvanced ? '#ffffff' : '#000000',
                fontSize: 15,
                fontWeight: 800,
                borderRadius: 14,
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: !isAdvanced ? '0 4px 16px rgba(16, 185, 129, 0.3)' : '0 4px 16px rgba(255, 255, 255, 0.2)',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s',
                minHeight: 48
              }}
            >
              {loading ? 'Генерация...' : isAdvanced ? '⚙️ Сгенерировать ключ' : '🚀 Получить доступ'}
            </button>
          </form>
        </div>
      ) : (

        /* FORM: RECOVER */
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
          borderRadius: 18,
          padding: 18,
          backdropFilter: 'var(--glass-blur)'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>
            {isAdvanced ? 'Восстановление подписки' : 'Найти мой ключ'}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.4 }}>
            Введите токен или ссылку вашей подписки для загрузки настроек.
          </p>

          <form onSubmit={handleRecover}>
            <input
              type="text"
              placeholder="Токен или ссылка подписки"
              value={recoverToken}
              onChange={(e) => setRecoverToken(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 10,
                padding: '10px 12px',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                marginBottom: 14,
                minHeight: 42
              }}
              required
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: '#ffffff',
                color: '#000000',
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 12,
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                minHeight: 46
              }}
            >
              {loading ? 'Поиск...' : '🔍 Найти профиль'}
            </button>
          </form>
        </div>
      )}

      {/* SUPPORTED APPS LIST */}
      <div style={{ marginTop: 22 }}>
        <h4 style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          📱 Приложения для подключения
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 1. v2raytun (Android) */}
          <a
            href="https://play.google.com/store/apps/details?id=com.v2raytun.android"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '12px 14px',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 800 }}>v2raytun</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Google Play (Android)</div>
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#34d399', fontWeight: 700 }}>Скачать ↗</span>
          </a>

          {/* 2. Incy (iOS / App Store) - SECOND PLACE */}
          <a
            href="https://apps.apple.com/app/id6478950800"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '12px 14px',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🍎</span>
              <div>
                <div style={{ fontWeight: 800 }}>Incy</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>App Store (iOS)</div>
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#c084fc', fontWeight: 700 }}>Скачать из App Store ↗</span>
          </a>

          {/* 3. Happ App (Android) */}
          <a
            href="https://play.google.com/store/apps/details?id=com.happproxy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '12px 14px',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 800 }}>Happ App</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Google Play (Android)</div>
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#34d399', fontWeight: 700 }}>Скачать ↗</span>
          </a>
        </div>
      </div>

    </div>
  );
}
