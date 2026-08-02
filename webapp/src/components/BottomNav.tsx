import type { Page } from '../App';
import { Home, Layers, ShieldCheck, History, Settings, ShieldAlert } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram';

interface BottomNavProps {
  current: Page;
  navigate: (page: Page) => void;
  isAdmin?: boolean;
}

interface NavTab {
  id: Page;
  label: string;
  Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}

export function BottomNav({ current, navigate, isAdmin }: BottomNavProps) {
  const { haptic } = useTelegram();

  const tabs: NavTab[] = [
    { id: 'home', label: 'ГЛАВНАЯ', Icon: Home },
    { id: 'plans', label: 'ТАРИФЫ', Icon: Layers },
    { id: 'subscription', label: 'VPN', Icon: ShieldCheck },
    { id: 'history', label: 'ИСТОРИЯ', Icon: History },
    { id: 'settings', label: 'ЕЩЁ', Icon: Settings },
  ];

  if (isAdmin) {
    tabs.push({ id: 'admin', label: 'АДМИН', Icon: ShieldAlert });
  }

  return (
    <div className="noir-nav-container">
      <nav className="noir-nav">
        {tabs.map((tab) => {
          const isActive = current === tab.id;
          const { Icon } = tab;

          return (
            <button
              key={tab.id}
              className={`noir-nav-tab ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (!isActive) {
                  haptic('light');
                  navigate(tab.id);
                }
              }}
            >
              <Icon
                size={18}
                style={{
                  color: isActive ? '#000000' : 'var(--text-secondary)',
                  transition: 'color 0.18s ease',
                }}
              />
              <span className="noir-nav-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
