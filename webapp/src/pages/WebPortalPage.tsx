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

const safeGetStorage = (key: string): string => {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
};
const safeSetStorage = (key: string, val: string) => {
  try { localStorage.setItem(key, val); } catch {}
};

// ── Palette ──────────────────────────────────────────────
const P = {
  bg:           '#060a12',
  bgCard:       'rgba(255,255,255,0.03)',
  bgCardHover:  'rgba(255,255,255,0.06)',
  border:       'rgba(255,255,255,0.08)',
  borderLight:  'rgba(255,255,255,0.14)',
  cyan:         '#22d3ee',
  cyanGlow:     'rgba(34,211,238,0.25)',
  cyanDim:      'rgba(34,211,238,0.15)',
  indigo:       '#818cf8',
  indigoGlow:   'rgba(129,140,248,0.25)',
  indigoDim:    'rgba(129,140,248,0.15)',
  amber:        '#fbbf24',
  amberDim:     'rgba(251,191,36,0.12)',
  success:      '#34d399',
  successDim:   'rgba(52,211,153,0.12)',
  danger:       '#f87171',
  textPrimary:  '#f1f5f9',
  textSec:      '#64748b',
  textMuted:    '#334155',
} as const;

export function WebPortalPage() {
  const [config, setConfig]           = useState<WebConfig | null>(null);
  const [captcha, setCaptcha]         = useState<CaptchaData | null>(null);
  const [answer, setAnswer]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [result, setResult]           = useState<TrialResult | null>(null);
  const [copied, setCopied]           = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showQr, setShowQr]           = useState(false);
  const [toast, setToast]             = useState<string | null>(null);

  // 'trial' | 'recover' — used in both modes
  const [mode, setMode]               = useState<'trial' | 'recover'>('trial');
  const [recoverToken, setRecoverToken] = useState('');

  const [isAdvanced, setIsAdvanced]   = useState<boolean>(() =>
    safeGetStorage('veilora_web_mode') === 'advanced'
  );

  const toggleAdvanced = (adv: boolean) => {
    setIsAdvanced(adv);
    safeSetStorage('veilora_web_mode', adv ? 'advanced' : 'simple');
  };

  useEffect(() => { fetchConfig(); fetchCaptcha(); }, []);

  async function fetchConfig() {
    try {
      const res = await fetch('/api/v1/web/config');
      if (res.ok) setConfig(await res.json());
    } catch {}
  }

  async function fetchCaptcha() {
    try {
      const res = await fetch('/api/v1/web/captcha');
      if (res.ok) { setCaptcha(await res.json()); setAnswer(''); }
    } catch {}
  }

  async function handleGetTrial(e: React.FormEvent) {
    e.preventDefault();
    if (!captcha || !answer.trim()) { setError('Ответьте на проверочный вопрос'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/v1/web/free-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captcha_id: captcha.captcha_id, answer: answer.trim(), device_token: safeGetStorage('veilora_trial_token') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка получения конфигурации');
      if (data.public_token) safeSetStorage('veilora_trial_token', data.public_token);
      setResult(data);
    } catch (err: any) { setError(err.message || 'Произошла ошибка'); fetchCaptcha(); }
    finally { setLoading(false); }
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    if (!recoverToken.trim()) { setError('Введите ваш токен'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/v1/web/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recoverToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Профиль не найден');
      if (data.public_token) safeSetStorage('veilora_trial_token', data.public_token);
      setResult(data);
    } catch (err: any) { setError(err.message || 'Ошибка восстановления'); }
    finally { setLoading(false); }
  }

  const copyText = (text: string, isToken = false) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    if (isToken) { setTokenCopied(true); setTimeout(() => setTokenCopied(false), 2000); }
    else         { setCopied(true);      setTimeout(() => setCopied(false), 2000);      }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleConnect = (appUrl: string, subUrl: string) => {
    copyText(subUrl); showToast('📋 Ссылка скопирована!');
    setTimeout(() => { window.location.href = appUrl; }, 100);
  };

  const brandName = (config?.brand_name || 'Veilora').replace(/VPN/gi, '').trim() || 'Veilora';
  const accent    = isAdvanced ? P.indigo : P.cyan;
  const accentGlow = isAdvanced ? P.indigoGlow : P.cyanGlow;
  const accentDim  = isAdvanced ? P.indigoDim  : P.cyanDim;
  const btnGrad   = isAdvanced
    ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
    : 'linear-gradient(135deg, #06b6d4, #0891b2)';

  return (
    <div style={{ minHeight: '100vh', background: P.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 48px' }}>

      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(ellipse at 50% -10%, ${isAdvanced ? 'rgba(99,102,241,0.09)' : 'rgba(6,182,212,0.08)'} 0%, transparent 60%)`
      }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: P.success, color: '#022c22',
          padding: '10px 20px', borderRadius: 20, fontWeight: 800, fontSize: 13,
          boxShadow: `0 8px 24px ${P.successDim}`, whiteSpace: 'nowrap',
          maxWidth: 'calc(100vw - 32px)', animation: 'fadeUp .3s ease',
        }}>
          {toast}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 420, padding: '28px 16px 0', position: 'relative', zIndex: 1, boxSizing: 'border-box' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 58, height: 58, borderRadius: 18, marginBottom: 14, fontSize: 26,
            background: `linear-gradient(145deg, ${accentDim}, rgba(255,255,255,0.02))`,
            border: `1px solid ${accentDim}`,
            boxShadow: `0 8px 32px ${accentGlow}`,
            transition: 'all .35s ease',
          }}>
            {isAdvanced ? '⚙️' : '⚡'}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: P.textPrimary, margin: '0 0 5px', letterSpacing: '-0.4px' }}>
            {brandName}
          </h1>
          <p style={{ fontSize: 12.5, color: P.textSec, margin: 0, lineHeight: 1.4 }}>
            {isAdvanced ? 'Расширенное управление профилем' : 'Безопасный VPN-доступ'}
          </p>
        </div>

        {/* ── Mode Toggle ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', border: `1px solid ${P.border}`, borderRadius: 50, padding: 3 }}>
            {[
              { label: '⚡ Простой', adv: false, color: P.cyan,   grad: 'linear-gradient(135deg,#06b6d4,#0891b2)', glow: P.cyanGlow },
              { label: '⚙️ PRO',     adv: true,  color: P.indigo, grad: 'linear-gradient(135deg,#6366f1,#4f46e5)', glow: P.indigoGlow },
            ].map(({ label, adv, grad, glow }) => {
              const active = isAdvanced === adv;
              return (
                <button key={label} type="button" onClick={() => toggleAdvanced(adv)} style={{
                  padding: '7px 18px', borderRadius: 50, border: 'none',
                  background: active ? grad : 'transparent',
                  color: active ? '#ffffff' : P.textSec,
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  transition: 'all .25s ease',
                  boxShadow: active ? `0 2px 14px ${glow}` : 'none',
                  whiteSpace: 'nowrap',
                }}>{label}</button>
              );
            })}
          </div>
        </div>

        {/* ── PRO Tabs ── */}
        {isAdvanced && !result && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 4, background: 'rgba(255,255,255,0.03)', border: `1px solid ${P.border}`, borderRadius: 14, marginBottom: 16 }}>
            {[
              { label: '✨ Новый профиль', val: 'trial' as const },
              { label: '🔑 Восстановить',  val: 'recover' as const },
            ].map(({ label, val }) => (
              <button key={val} type="button" onClick={() => { setMode(val); setError(null); }} style={{
                padding: '10px', borderRadius: 10, border: 'none',
                background: mode === val ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: mode === val ? P.textPrimary : P.textSec,
                fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .2s', minHeight: 42,
              }}>{label}</button>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{ padding: '12px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, color: P.danger, fontSize: 13, lineHeight: 1.45, marginBottom: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            RESULT VIEW
        ══════════════════════════════════════════════ */}
        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Simple Result */}
            {!isAdvanced ? (
              <div style={{ background: `linear-gradient(145deg, ${P.successDim}, rgba(255,255,255,0.02))`, border: `1px solid rgba(52,211,153,0.25)`, borderRadius: 20, padding: '20px 16px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: P.textPrimary, margin: '0 0 6px' }}>Доступ активирован!</h3>
                  <p style={{ fontSize: 12.5, color: P.success, margin: 0 }}>
                    Действует до {new Date(result.period_end).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })}
                  </p>
                </div>
                <button type="button" onClick={() => { copyText(result.sub_link); showToast('✓ Ключ скопирован! Вставьте в VPN-приложение'); }} style={{
                  display: 'block', width: '100%', padding: '15px',
                  background: copied ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#10b981,#059669)',
                  color: '#fff', fontSize: 15, fontWeight: 800, borderRadius: 14, border: 'none', cursor: 'pointer',
                  boxShadow: '0 6px 24px rgba(16,185,129,0.3)', marginBottom: 10, minHeight: 52, transition: 'all .2s',
                }}>{copied ? '✓ Ключ скопирован!' : '📋 Скопировать ключ'}</button>
                {result.tg_link && (
                  <a href={result.tg_link} target="_blank" rel="noopener noreferrer" style={{
                    display: 'block', padding: '12px', background: 'rgba(129,140,248,0.12)', border: `1px solid rgba(129,140,248,0.3)`,
                    color: P.indigo, fontSize: 13, fontWeight: 700, borderRadius: 12, textAlign: 'center', textDecoration: 'none', marginBottom: 10, minHeight: 44,
                  }}>💬 Привязать к Telegram-боту</a>
                )}
                <button type="button" onClick={() => toggleAdvanced(true)} style={{ display: 'block', width: '100%', background: 'transparent', border: 'none', color: P.textSec, fontSize: 12, cursor: 'pointer', textAlign: 'center', padding: '6px' }}>
                  Нужны QR-код или выбор клиента? → PRO
                </button>
              </div>
            ) : (
              /* PRO Result */
              <div style={{ background: `linear-gradient(145deg, ${P.indigoDim}, rgba(255,255,255,0.02))`, border: `1px solid rgba(129,140,248,0.25)`, borderRadius: 20, padding: '20px 16px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: P.textPrimary }}>⚙️ Параметры профиля</div>
                    <div style={{ fontSize: 11, color: P.indigo, marginTop: 2 }}>До {new Date(result.period_end).toLocaleString('ru-RU')}</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: P.successDim, border: `1px solid rgba(52,211,153,0.3)`, color: P.success, fontSize: 10, fontWeight: 800 }}>ACTIVE</span>
                </div>
                {/* Token */}
                <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${P.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: P.textSec, letterSpacing: '0.06em' }}>Токен профиля</span>
                    <button type="button" onClick={() => copyText(result.public_token, true)} style={{ background: 'transparent', border: 'none', color: tokenCopied ? P.success : P.indigo, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {tokenCopied ? '✓ Скопировано' : 'Скопировать'}
                    </button>
                  </div>
                  <code style={{ display: 'block', fontSize: 11, color: P.textPrimary, wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>{result.public_token}</code>
                </div>
                {/* Sub link */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: P.textSec, display: 'block', marginBottom: 6, letterSpacing: '0.06em' }}>Ссылка подписки</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input readOnly value={result.sub_link} style={{ flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.4)', border: `1px solid ${P.border}`, borderRadius: 10, padding: '8px 10px', color: P.textPrimary, fontSize: 11, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
                    <button type="button" onClick={() => copyText(result.sub_link)} style={{ flexShrink: 0, background: copied ? P.success : P.textPrimary, color: copied ? '#fff' : '#000', border: 'none', borderRadius: 10, padding: '0 12px', fontWeight: 800, fontSize: 12, cursor: 'pointer', transition: 'all .2s' }}>
                      {copied ? '✓' : 'Копировать'}
                    </button>
                  </div>
                </div>
                {/* App buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {[
                    { label: '⚡ v2raytun', url: result.v2raytun_link },
                    { label: '📱 Happ',     url: result.happ_link },
                  ].map(({ label, url }) => (
                    <button key={label} type="button" onClick={() => handleConnect(url, result.sub_link)} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}`, color: P.textPrimary, fontSize: 12, fontWeight: 700, padding: '10px 8px', borderRadius: 12, cursor: 'pointer', minHeight: 42, transition: 'background .2s' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {/* QR */}
                <button type="button" onClick={() => setShowQr(!showQr)} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: `1px solid ${P.border}`, color: P.textSec, fontSize: 12, fontWeight: 600, borderRadius: 10, cursor: 'pointer', padding: '9px 0', marginBottom: 10 }}>
                  {showQr ? '▲ Скрыть QR-код' : '📷 Показать QR-код'}
                </button>
                {showQr && (
                  <div style={{ textAlign: 'center', padding: 14, background: '#fff', borderRadius: 16, marginBottom: 12 }}>
                    <img src={result.qr_code} alt="QR" style={{ width: 160, height: 160, display: 'block', margin: '0 auto 10px' }} />
                    <a href={result.qr_code} download="veilora-qr.png" style={{ display: 'inline-block', padding: '6px 14px', background: '#111827', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>💾 Скачать PNG</a>
                  </div>
                )}
                {result.tg_link && (
                  <a href={result.tg_link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '12px', background: `linear-gradient(135deg, #6366f1, #4f46e5)`, color: '#fff', fontSize: 13, fontWeight: 800, borderRadius: 12, textAlign: 'center', textDecoration: 'none', minHeight: 44 }}>
                    💬 Авторизовать в Telegram
                  </a>
                )}
              </div>
            )}

            {/* Back button */}
            <button type="button" onClick={() => { setResult(null); fetchCaptcha(); setMode('trial'); }} style={{ background: 'transparent', border: `1px solid ${P.border}`, color: P.textSec, padding: '11px', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer', minHeight: 44, transition: 'border-color .2s' }}>
              ← Назад
            </button>
          </div>

        ) : mode === 'trial' ? (
          /* ══ FORM: GET TRIAL ══ */
          <div style={{ background: P.bgCard, backdropFilter: 'blur(20px)', border: `1px solid ${P.border}`, borderRadius: 20, padding: '20px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: accentDim, border: `1px solid ${accentDim}`, color: accent, fontSize: 10, fontWeight: 800, marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {isAdvanced ? `⚙️ PRO · ${config?.trial_duration_days || 2} дн.` : '⚡ Бесплатный доступ'}
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: P.textPrimary, margin: '0 0 4px' }}>
                {isAdvanced ? 'Генерация профиля' : 'Получить VPN-доступ'}
              </h3>
              <p style={{ fontSize: 12, color: P.textSec, margin: 0, lineHeight: 1.4 }}>
                {isAdvanced ? 'Автоматическая выдача токена и конфигурации' : 'Пройдите быструю проверку и получите ключ'}
              </p>
            </div>

            <form onSubmit={handleGetTrial}>
              {/* Security check */}
              <div style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${P.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: P.textSec, display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🛡 Проверка безопасности
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: P.textPrimary, flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}`, borderRadius: 8, padding: '6px 12px', whiteSpace: 'nowrap' }}>
                    {captcha ? captcha.question : '...'}
                  </span>
                  <input
                    type="number"
                    placeholder="Ответ"
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    style={{ flex: '1 1 80px', minWidth: 0, background: 'rgba(255,255,255,0.06)', border: `1px solid ${P.borderLight}`, borderRadius: 8, padding: '9px 12px', color: P.textPrimary, fontSize: 15, fontWeight: 700, outline: 'none', minHeight: 42, boxSizing: 'border-box', WebkitAppearance: 'none' }}
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={loading || !captcha} style={{ width: '100%', padding: '14px', background: btnGrad, color: '#fff', fontSize: 15, fontWeight: 800, borderRadius: 14, border: 'none', cursor: loading ? 'wait' : 'pointer', boxShadow: `0 4px 20px ${accentGlow}`, opacity: loading ? 0.7 : 1, transition: 'all .2s', minHeight: 50 }}>
                {loading ? '⏳ Генерация...' : isAdvanced ? '⚙️ Создать профиль' : '🚀 Получить доступ'}
              </button>
            </form>

            {/* Simple mode — recover link */}
            {!isAdvanced && (
              <button type="button" onClick={() => { setMode('recover'); setError(null); const saved = safeGetStorage('veilora_trial_token'); if (saved) setRecoverToken(saved); }} style={{ display: 'block', width: '100%', marginTop: 12, background: 'transparent', border: 'none', color: P.textSec, fontSize: 12, cursor: 'pointer', textAlign: 'center', padding: '4px' }}>
                Уже есть ключ? Восстановить →
              </button>
            )}
          </div>

        ) : (
          /* ══ FORM: RECOVER ══ */
          <div style={{ background: P.bgCard, backdropFilter: 'blur(20px)', border: `1px solid ${P.border}`, borderRadius: 20, padding: '20px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div style={{ marginBottom: 14 }}>
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: P.amberDim, border: `1px solid rgba(251,191,36,0.25)`, color: P.amber, fontSize: 10, fontWeight: 800, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                🔑 Восстановление
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: P.textPrimary, margin: '0 0 4px' }}>Восстановить профиль</h3>
              <p style={{ fontSize: 12, color: P.textSec, margin: 0, lineHeight: 1.4 }}>Введите токен, который был выдан при первом получении доступа</p>
            </div>

            <form onSubmit={handleRecover}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: P.textSec, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Токен профиля</label>
                <input
                  type="text"
                  placeholder="Вставьте ваш токен..."
                  value={recoverToken}
                  onChange={e => setRecoverToken(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: `1px solid ${P.borderLight}`, borderRadius: 10, padding: '11px 12px', color: P.textPrimary, fontSize: 13, fontFamily: 'monospace', outline: 'none', minHeight: 44 }}
                  required
                />
                <p style={{ fontSize: 11, color: P.textMuted, margin: '6px 0 0', lineHeight: 1.4 }}>💡 Токен отображался после первого получения доступа</p>
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: `linear-gradient(135deg, ${P.amber}, #d97706)`, color: '#000', fontSize: 14, fontWeight: 800, borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer', boxShadow: `0 4px 20px ${P.amberDim}`, opacity: loading ? 0.7 : 1, minHeight: 48, transition: 'all .2s' }}>
                {loading ? '⏳ Поиск...' : '🔑 Восстановить доступ'}
              </button>
            </form>

            {/* ← Back button — both simple and PRO */}
            <button type="button" onClick={() => { setMode('trial'); setError(null); setRecoverToken(''); }} style={{ display: 'block', width: '100%', marginTop: 10, background: 'transparent', border: `1px solid ${P.border}`, color: P.textSec, fontSize: 13, fontWeight: 600, borderRadius: 12, cursor: 'pointer', padding: '11px', minHeight: 44, transition: 'border-color .2s' }}>
              ← Вернуться назад
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateX(-50%) translateY(-8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0 }
        input[type=number] { -moz-appearance:textfield }
        button:active { opacity:.82; transform:scale(.97) }
      `}</style>
    </div>
  );
}
