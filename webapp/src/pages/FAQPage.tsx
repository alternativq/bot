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
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  q: string;
  a: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    icon: Link,
    q: 'Как подключиться к VPN?',
    a: 'Откройте раздел «Моя подписка» → скопируйте ссылку-подписку → в приложении VPN-клиента выберите «Import from URL» или отсканируйте QR-код → обновите список серверов → подключайтесь.',
  },
  {
    icon: Smartphone,
    q: 'Какое приложение установить?',
    a: 'Android → v2rayNG или Hiddify\niOS → Streisand, Happ или V2Box\nWindows → v2rayN или Hiddify\nmacOS → FoXray или Hiddify',
  },
  {
    icon: Wrench,
    q: 'Ссылка не работает, что делать?',
    a: 'Попробуйте обновить подписку в приложении (Update subscription). Убедитесь, что время на устройстве выставлено корректно (автоматически). Если не помогает — напишите в поддержку.',
  },
  {
    icon: Laptop,
    q: 'Можно ли использовать на нескольких устройствах?',
    a: 'Да, если ваш тариф поддерживает несколько устройств (3, 5 или 7). Одна ссылка-подписка добавляется на все устройства одновременно.',
  },
  {
    icon: RefreshCw,
    q: 'Как продлить подписку?',
    a: 'Перейдите в «Тарифы» → выберите нужный срок и количество устройств → оплатите. Подписка продлится автоматически, ваша ссылка не изменится.',
  },
  {
    icon: Gift,
    q: 'Как работает пробный период?',
    a: 'Пробный доступ выдаётся бесплатно, один раз на аккаунт. Длительность — 2-3 дня. После этого нужно оформить платную подписку.',
  },
  {
    icon: Tag,
    q: 'Как использовать промокод?',
    a: 'Откройте «Настройки» → введите промокод в соответствующее поле → нажмите «Применить». Скидка применится к следующей покупке.',
  },
  {
    icon: Users,
    q: 'Как работает реферальная программа?',
    a: 'В разделе «Настройки» скопируйте реферальную ссылку и отправьте другу. Когда он оформит первую подписку — вы получите +5 дней бонусом к вашей подписке.',
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
      <div style={styles.headerRow}>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => {
            haptic('light');
            navigate('settings');
          }}
          style={{ width: 36, height: 36 }}
        >
          <ArrowLeft size={18} />
        </button>
        <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Частые вопросы</h2>
      </div>

      {/* Search Input */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 16, marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search size={18} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по вопросам..."
          style={styles.searchInput}
        />
      </div>

      {/* Accordion list */}
      {filteredItems.length === 0 ? (
        <div className="empty-state">
          <div className="title">Ничего не найдено</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Попробуйте изменить поисковый запрос
          </p>
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
                <span style={styles.questionRow}>
                  <div style={styles.iconWrapper}>
                    <IconComp size={16} style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <span>{item.q}</span>
                </span>

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

const styles: Record<string, React.CSSProperties> = {
  pageTitle: {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 20,
    letterSpacing: '-0.02em',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  questionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
