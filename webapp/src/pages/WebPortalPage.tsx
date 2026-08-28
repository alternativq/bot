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
    navigator.clipboard.writeText(text);
    if (isToken) {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const rawBrand = config?.brand_name || 'Veilora';
  const brandName = rawBrand.replace(/VPN/gi, '').trim() || 'Veilora';

  return (
    <div className="page" style={{ paddingTop: 20, paddingBottom: 40, maxWidth: 520, margin: '0 auto' }}>
      
      {/* MODE TOGGLE SWITCH (SIMPLE vs PRO) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
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
              padding: '7px 16px',
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
              padding: '7px 16px',
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
            ⚙️ Расширенный (PRO)
          </button>
        </div>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          background: isAdvanced 
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(255, 255, 255, 0.05) 100%)'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(255, 255, 255, 0.05) 100%)',
          border: isAdvanced ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
          fontSize: 28,
          boxShadow: isAdvanced ? '0 8px 24px rgba(139, 92, 246, 0.25)' : '0 8px 24px rgba(16, 185, 129, 0.25)',
          transition: 'all 0.3s ease'
        }}>
          {isAdvanced ? '⚙️' : '⚡'}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', color: '#ffffff' }}>
          {brandName}
        </h1>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, padding: '0 12px' }}>
          {isAdvanced 
            ? 'Расширенная панель управления сетевым протоколом и профилями' 
            : 'Персональный безопасный доступ в 1 клик'}
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 6,
        padding: 4,
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 14,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: 18
      }}>
        <button
          type="button"
          onClick={() => { setMode('trial'); setError(null); }}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: 'none',
            background: mode === 'trial' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
            color: mode === 'trial' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ✨ {isAdvanced ? 'Новая подписка' : 'Получить доступ'}
        </button>
        <button
          type="button"
          onClick={() => { setMode('recover'); setError(null); }}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: 'none',
            background: mode === 'recover' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
            color: mode === 'recover' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.2s'
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
          marginBottom: 18,
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
                cursor: 'pointer'
              }}
            >
              🔍 Найти ранее созданный профиль
            </button>
          )}
        </div>
      )}

      {/* RESULT VIEW */}
      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* SIMPLIFIED RESULT VIEW (Default) */}
          {!isAdvanced ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(19, 19, 24, 0.9) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 20,
              padding: 22,
              boxShadow: '0 12px 30px rgba(0,0,0,0.45)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: 42, marginBottom: 6 }}>🎉</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
                  Подключение успешно создано!
                </h3>
                <p style={{ fontSize: 13, color: '#a7f3d0', margin: 0 }}>
                  Пробный доступ активен до {new Date(result.period_end).toLocaleDateString('ru-RU')}
                </p>
              </div>

              {/* 3-Step Simple Instructions */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                borderRadius: 14,
                padding: 14,
                marginBottom: 18,
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#e5e7eb', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  📋 Инструкция за 3 шага:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#d1d5db' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: '#10b981', color: '#000', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>1</span>
                    <span>Нажмите зелёную кнопку ниже, чтобы импортировать сервер</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: '#10b981', color: '#000', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>2</span>
                    <span>В приложении нажмите кнопку <strong>«Включить»</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: '#10b981', color: '#000', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>3</span>
                    <span>Привяжите профиль к Telegram для сохранения</span>
                  </div>
                </div>
              </div>

              {/* Main Action Launchers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <a
                  href={result.v2raytun_link}
                  style={{
                    display: 'block',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontSize: 15,
                    fontWeight: 800,
                    borderRadius: 14,
                    textAlign: 'center',
                    textDecoration: 'none',
                    boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  🚀 Подключить в 1-клик (v2raytun)
                </a>

                <a
                  href={result.happ_link}
                  style={{
                    display: 'block',
                    padding: '13px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 14,
                    textAlign: 'center',
                    textDecoration: 'none'
                  }}
                >
                  📱 Подключить через Happ App
                </a>
              </div>

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
                    marginBottom: 10
                  }}
                >
                  💬 Привязать к Telegram-боту
                </a>
              )}

              <div style={{ textAlign: 'center', marginTop: 14 }}>
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
                  ⚙️ Нужна прямая ссылка или QR-код? Включить Расширенный режим
                </button>
              </div>
            </div>
          ) : (

            /* ADVANCED PRO RESULT VIEW */
            <div style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(19, 19, 24, 0.9) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              borderRadius: 20,
              padding: 20,
              boxShadow: '0 12px 30px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>⚙️</span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#fff' }}>
                      Параметры подписки (PRO)
                    </h3>
                    <p style={{ fontSize: 12, color: '#c084fc', margin: 0 }}>
                      Статус: Активен до {new Date(result.period_end).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
                  fontSize: 11,
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
                padding: 12,
                marginBottom: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
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
                <code style={{ fontSize: 12, color: '#f3f4f6', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {result.public_token}
                </code>
              </div>

              {/* Subscription Link */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Единая ссылка подписки (Unified Sub URL)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    value={result.sub_link}
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: 12,
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
                      padding: '0 14px',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                    }}
                  >
                    {copied ? 'Скопировано!' : 'Копировать'}
                  </button>
                </div>
              </div>

              {/* Quick Launch Protocol Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <a
                  href={result.v2raytun_link}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: 12,
                    padding: '11px',
                    borderRadius: 12,
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontWeight: 700
                  }}
                >
                  ⚡ v2raytun Protocol
                </a>
                <a
                  href={result.happ_link}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: 12,
                    padding: '11px',
                    borderRadius: 12,
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontWeight: 700
                  }}
                >
                  📱 Happ Protocol
                </a>
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
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 10,
                  cursor: 'pointer',
                  padding: '8px 0',
                  marginBottom: 12
                }}
              >
                {showQr ? '▲ Скрыть QR-код' : '📷 Показать QR-код для мобильного импорта'}
              </button>

              {showQr && (
                <div style={{ textAlign: 'center', marginTop: 8, padding: 14, background: '#fff', borderRadius: 14, marginBottom: 14 }}>
                  <img src={result.qr_code} alt="QR Code" style={{ width: 180, height: 180, display: 'block', margin: '0 auto 10px' }} />
                  <a
                    href={result.qr_code}
                    download="veilora-qr.png"
                    style={{
                      display: 'inline-block',
                      padding: '6px 14px',
                      background: '#111827',
                      color: '#ffffff',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    💾 Скачать QR-код (PNG)
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
                    padding: '12px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    borderRadius: 12,
                    textAlign: 'center',
                    textDecoration: 'none'
                  }}
                >
                  💬 Авторизовать профиль в Telegram
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
              padding: '12px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              marginTop: 4
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
          borderRadius: 20,
          padding: 20,
          backdropFilter: 'var(--glass-blur)'
        }}>
          {/* Form Header */}
          <div style={{ marginBottom: 16 }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: 20,
              background: !isAdvanced ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.2)',
              border: !isAdvanced ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
              color: !isAdvanced ? '#34d399' : '#c084fc',
              fontSize: 11,
              fontWeight: 800,
              marginBottom: 8
            }}>
              {isAdvanced ? '⚙️ PRO ТАРИФ: TRIAL' : '🌱 ПРОСТОЙ ДОСТУП'}
            </span>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
              {isAdvanced 
                ? `Генерация тестовой подписки (${config?.trial_duration_days || 2} дня)` 
                : `Получить доступ в 1 клик`}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              {isAdvanced 
                ? 'Формирование нового протокола с изоляцией IP и автоматической выдачей токена.'
                : 'Нажмите кнопку ниже для быстрого подключения на вашем устройстве.'}
            </p>
          </div>

          <form onSubmit={handleGetTrial}>
            {/* CAPTCHA PUZZLE BOX */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 14,
              padding: 14,
              marginBottom: 16
            }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                🛡 Проверка безопасности:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', minWidth: 110 }}>
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
                    borderRadius: 10,
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none'
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
                padding: '14px',
                background: !isAdvanced ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#ffffff',
                color: !isAdvanced ? '#ffffff' : '#000000',
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 14,
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: !isAdvanced ? '0 4px 16px rgba(16, 185, 129, 0.3)' : '0 4px 16px rgba(255, 255, 255, 0.2)',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Генерация...' : isAdvanced ? '⚙️ Сгенерировать ключ' : '🚀 Получить доступ в 1 клик'}
            </button>
          </form>
        </div>
      ) : (

        /* FORM: RECOVER */
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
          borderRadius: 20,
          padding: 20,
          backdropFilter: 'var(--glass-blur)'
        }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
            {isAdvanced ? 'Восстановление по токену / ссылке' : 'Найти мой ключ'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.45 }}>
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
                borderRadius: 12,
                padding: '12px 14px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
                marginBottom: 16
              }}
              required
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: '#ffffff',
                color: '#000000',
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 14,
                border: 'none',
                cursor: loading ? 'wait' : 'pointer'
              }}
            >
              {loading ? 'Поиск...' : '🔍 Найти профиль'}
            </button>
          </form>
        </div>
      )}

      {/* DOWNLOAD APPS GUIDE */}
      <div style={{ marginTop: 24 }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          📱 Поддерживаемые клиенты (Android)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: isAdvanced ? '1fr 1fr' : '1fr 1fr', gap: 10 }}>
          <a
            href="https://play.google.com/store/apps/details?id=com.v2raytun.android"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: 12,
              color: '#fff',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            🤖 <strong>v2raytun</strong> (Android)
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.happproxy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: 12,
              color: '#fff',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            🤖 <strong>Happ App</strong> (Android)
          </a>
        </div>
      </div>

    </div>
  );
}
