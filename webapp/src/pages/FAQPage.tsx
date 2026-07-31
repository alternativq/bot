import { useEffect, useState } from 'react';
import type { Page } from '../App';
import { useTelegram } from '../hooks/useTelegram';

interface FAQPageProps {
  navigate: (page: Page) => void;
}

interface FAQItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    q: 'Как подключиться к VPN?',
    a: 'Откройте раздел «Моя подписка» → скопируйте ссылку-подписку → в приложении VPN-клиента выберите «Import from URL» или отсканируйте QR-код → обновите список серверов → подключайтесь.',
  },
  {
    q: 'Какое приложение установить?',
    a: 'Android → v2rayNG\niOS → Streisand или Happ\nWindows → v2rayN или Hiddify\nmacOS → Hiddify или FoXray',
  },
  {
    q: 'Ссылка не работает, что делать?',
    a: 'Попробуйте обновить подписку в приложении (Update subscription). Убедитесь, что время на устройстве выставлено корректно. Если не помогает — напишите в поддержку.',
  },
  {
    q: 'Можно ли использовать на нескольких устройствах?',
    a: 'Да, если ваш тариф поддерживает несколько устройств (3, 5 или 7). Одна ссылка-подписка добавляется на все устройства.',
  },
  {
    q: 'Как продлить подписку?',
    a: 'Перейдите в «Тарифы» → выберите нужный срок и количество устройств → оплатите. Подписка продлится автоматически, ссылка не изменится.',
  },
  {
    q: 'Как работает пробный период?',
    a: 'Пробный доступ выдаётся бесплатно, один раз на аккаунт. Длительность — 2 дня. После этого нужно оформить платную подписку.',
  },
  {
    q: 'Как использовать промокод?',
    a: 'Откройте «Настройки» → введите промокод в соответствующее поле → нажмите «OK». Скидка применится к следующей покупке.',
  },
  {
    q: 'Как работает реферальная программа?',
    a: 'В разделе «Настройки» скопируйте реферальную ссылку и отправьте другу. Когда он оформит первую подписку — вы получите +5 дней бонусом к вашей подписке.',
  },
];

export function FAQPage({ navigate }: FAQPageProps) {
  const { showBackButton, hideBackButton, haptic } = useTelegram();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    showBackButton(() => navigate('settings'));
    return () => hideBackButton();
  }, [navigate, showBackButton, hideBackButton]);

  return (
    <div className="page">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Частые вопросы</h2>

      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div key={idx} className="accordion-item">
            <button
              className={`accordion-header ${isOpen ? 'open' : ''}`}
              onClick={() => {
                haptic();
                setOpenIdx(isOpen ? null : idx);
              }}
            >
              <span>{item.q}</span>
              <span className="arrow">▼</span>
            </button>
            {isOpen && (
              <div className="accordion-body">
                {item.a.split('\n').map((line, i) => (
                  <p key={i} style={{ marginBottom: i < item.a.split('\n').length - 1 ? 4 : 0 }}>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
