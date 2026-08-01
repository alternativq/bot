import { useEffect, useState, useMemo } from 'react';
import type { Page } from '../App';
import { useTelegram } from '../hooks/useTelegram';
import {
  Link,
  Smartphone,
  Wrench,
  Laptop,
  RefreshCw,
  Gift,
  Tag,
  Users,
  ChevronDown,
  ArrowLeft,
  Search,
} from 'lucide-react';

interface FAQPageProps {
  navigate: (page: Page) => void;
}

interface FAQItem {
  icon: React.ComponentType<{ size?: number }>;
  q: string;
  a: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    icon: Link,
    q: 'Как подключиться к VPN?',
    a: 'Откройте раздел «Моя подписка» → скопируйте ссылку-подписку → в приложении VPN-клиента выберите «Import from Clipboard» или отсканируйте QR-код → обновите серверы.',
  },
  {
    icon: Smartphone,
    q: 'Какое приложение установить?',
    a: 'Android → v2rayNG или Hiddify\niOS → Streisand, Happ или V2Box\nWindows → v2rayN или Hiddify\nmacOS → FoXray или Hiddify',
  },
  {
    icon: Wrench,
    q: 'Ссылка не работает, что делать?',
    a: 'Попробуйте обновить подписку в приложении (Update subscription). Убедитесь, что точное время на устройстве синхронизировано автоматически.',
  },
  {
    icon: Laptop,
    q: 'Можно ли использовать на нескольких устройствах?',
    a: 'Да, в зависимости от лимита вашего тарифа (1, 3 или 5 устройств). Достаточно добавить ссылку на каждое устройство.',
  },
  {
    icon: RefreshCw,
    q: 'Как продлить подписку?',
    a: 'Перейдите в раздел «Тарифы» → выберите тариф → оплатите. Срок автоматически продлится, ссылка не изменится.',
  },
  {
    icon: Gift,
    q: 'Как работает пробный период?',
    a: 'Бесплатный тестовый период выдаётся 1 раз на аккаунт. Длительность — 2 дня без привязки банковской карты.',
  },
  {
    icon: Tag,
    q: 'Как активировать промокод?',
    a: 'Откройте «Настройки» → введите промокод в соответствующее поле → нажмите «Применить».',
  },
  {
    icon: Users,
    q: 'Как работает реферальная система?',
    a: 'Скопируйте реферальную ссылку в настройках и отправьте другу. При его первой оплате вы получите +5 дней в подарок.',
  },
];

export function FAQPage({ navigate }: FAQPageProps) {
  const { showBackButton, hideBackButton, haptic } = useTelegram();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    showBackButton(() => navigate('settings'));
    return () => hideBackButton();
  }, [navigate, showBackButton, hideBackButton]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_ITEMS;
    const q = searchQuery.toLowerCase();
    return FAQ_ITEMS.filter(
      (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          className="noir-icon-btn"
          onClick={() => {
            haptic('light');
            navigate('settings');
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 850, color: '#ffffff' }}>Вопросы и ответы</div>
      </div>

      <div className="card" style={{ padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search size={18} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по базе знаний..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-state">
          <div className="title">Ничего не найдено</div>
        </div>
      ) : (
        filteredItems.map((item, idx) => {
          const isOpen = openIdx === idx;
          const IconComp = item.icon;

          return (
            <div key={idx} className="accordion-item">
              <button
                className={`accordion-header ${isOpen ? 'open' : ''}`}
                onClick={() => {
                  haptic('light');
                  setOpenIdx(isOpen ? null : idx);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10 }}>
                  <div className="noir-card-icon-box" style={{ width: 34, height: 34, borderRadius: 10 }}>
                    <IconComp size={16} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 750, color: '#ffffff' }}>{item.q}</span>
                </div>

                <ChevronDown
                  size={16}
                  className="arrow"
                  style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.25s ease',
                  }}
                />
              </button>

              {isOpen && (
                <div className="accordion-body">
                  {item.a.split('\n').map((line, i) => (
                    <p key={i} style={{ marginBottom: i < item.a.split('\n').length - 1 ? 6 : 0 }}>
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
