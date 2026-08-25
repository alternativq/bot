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
  const [showQr, setShowQr] = useState(false);
  
  // Recover mode
  const [mode, setMode] = useState<'trial' | 'recover'>('trial');
  const [recoverToken, setRecoverToken] = useState('');

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
      setError(null);
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

    try {
      const res = await fetch('/api/v1/web/free-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captcha_id: captcha.captcha_id,
          answer: answer.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка получения конфигурации');
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

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка восстановления');
    } finally {
      setLoading(false);
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const brandName = config?.brand_name || 'Veilora Network';

  return (
    <div className="page" style={{ paddingTop: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(255, 255, 255, 0.05) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
          fontSize: 32,
          boxShadow: '0 8px 24px rgba(139, 92, 246, 0.25)'
        }}>
          ⚡
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', color: '#ffffff' }}>
          {brandName}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, padding: '0 12px' }}>
          Персональный протокол высокой скорости и защиты сетевого соединения
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 6,
        padding: 4,
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 14,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: 20
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
          ✨ Тестовый профиль
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
          🔍 Найти профиль
        </button>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 14,
          color: '#f87171',
          fontSize: 13,
          marginBottom: 18,
          lineHeight: 1.4
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* RESULT VIEW */}
      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(19, 19, 24, 0.8) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 20,
            padding: 20,
            boxShadow: '0 12px 30px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>✅</span>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#fff' }}>
                  Конфигурация сгенерирована!
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Срок действия: до {new Date(result.period_end).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Ссылка конфигурации (импортируйте в клиент)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={result.sub_link}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.4)',
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
                    fontWeight: 700,
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

            {/* Quick launch buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <a
                href={result.happ_link}
                className="btn"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 13,
                  padding: '12px',
                  borderRadius: 12,
                  textAlign: 'center',
                  textDecoration: 'none',
                  fontWeight: 700
                }}
              >
                📱 Запустить Happ
              </a>
              <a
                href={result.v2raytun_link}
                className="btn"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 13,
                  padding: '12px',
                  borderRadius: 12,
                  textAlign: 'center',
                  textDecoration: 'none',
                  fontWeight: 700
                }}
              >
                ⚡ v2raytun
              </a>
            </div>

            {/* Toggle QR Code */}
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: 12,
                cursor: 'pointer',
                padding: '4px 0',
                textDecoration: 'underline'
              }}
            >
              {showQr ? 'Скрыть QR-код' : '📷 Показать QR-код для импорта'}
            </button>

            {showQr && (
              <div style={{ textAlign: 'center', marginTop: 12, padding: 12, background: '#fff', borderRadius: 14 }}>
                <img src={result.qr_code} alt="QR Code" style={{ width: 180, height: 180, display: 'block', margin: '0 auto' }} />
              </div>
            )}
          </div>

          {/* TELEGRAM LINKING BANNER */}
          {result.tg_link && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(19, 19, 24, 0.9) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: 20,
              padding: 20,
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.2)'
            }}>
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
                🚀 Шаг 3. Активируйте соединение и привяжите бот
              </h4>
              <p style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.45, margin: '0 0 14px' }}>
                После включения соединения откройте Telegram и нажмите кнопку ниже, чтобы привязать данный профиль к вашему Telegram-аккаунту.
              </p>
              <a
                href={result.tg_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 800,
                  borderRadius: 14,
                  textAlign: 'center',
                  textDecoration: 'none',
                  boxShadow: '0 6px 20px rgba(139, 92, 246, 0.4)'
                }}
              >
                💬 Открыть Telegram-бот
              </a>
            </div>
          )}

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
              cursor: 'pointer'
            }}
          >
            ← Запросить другой профиль
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
          <div style={{ marginBottom: 16 }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: 20,
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              color: '#c084fc',
              fontSize: 11,
              fontWeight: 700,
              marginBottom: 8
            }}>
              ⚡ Экстренный доступ
            </span>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
              Получить тестовый ключ на {config?.trial_duration_days || 2} дня
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              Отсутствует доступ к сервисам? Получите временную конфигурацию. Подключитесь и зафиксируйте профиль в боте.
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
                background: '#ffffff',
                color: '#000000',
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 14,
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 4px 16px rgba(255, 255, 255, 0.2)',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Генерация...' : `🚀 Сгенерировать профиль`}
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
            Поиск профиля
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.45 }}>
            Введите токен конфигурации или ранее сохранённый код для загрузки настроек.
          </p>

          <form onSubmit={handleRecover}>
            <input
              type="text"
              placeholder="Введите токен конфигурации"
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
        <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          📱 Поддерживаемые клиенты
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <a
            href="https://apps.apple.com/app/happ-proxy-utility/id6504287928"
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
            🍎 <strong>Happ App</strong> (iOS / Mac)
          </a>
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
        </div>
      </div>
    </div>
  );
}
