import type { Page } from '../App';
import { Home, Layers, ShieldCheck, History, Settings } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram';

interface BottomNavProps {
  current: Page;
  navigate: (page: Page) => void;
}

interface NavTab {
  id: Page;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
}

const tabs: NavTab[] = [
  { id: 'home', label: 'Главная', Icon: Home },
  { id: 'plans', label: 'Тарифы', Icon: Layers },
  { id: 'subscription', label: 'VPN', Icon: ShieldCheck },
  { id: 'history', label: 'История', Icon: History },
  { id: 'settings', label: 'Ещё', Icon: Settings },
];

export function BottomNav({ current, navigate }: BottomNavProps) {
  const { haptic } = useTelegram();

  return (
    <nav style={styles.nav}>
      <div style={styles.navInner}>
        {tabs.map((tab) => {
          const isActive = current === tab.id;
          const { Icon } = tab;

          return (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => {
                if (!isActive) {
                  haptic('light');
                  navigate(tab.id);
                }
              }}
            >
              <div
                style={{
                  ...styles.iconContainer,
                  ...(isActive ? styles.iconContainerActive : {}),
                }}
              >
                <Icon
                  size={20}
                  style={{
                    color: isActive ? '#a78bfa' : 'var(--text-secondary)',
                    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                />
              </div>

              <span
                style={{
                  ...styles.label,
                  ...(isActive ? styles.labelActive : {}),
                }}
              >
                {tab.label}
              </span>

              {isActive && <span style={styles.activeIndicator} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: 'var(--safe-bottom)',
    background: 'rgba(8, 9, 18, 0.85)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  navInner: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 'var(--nav-height)',
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
    padding: '0 8px',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '6px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    position: 'relative' as const,
    transition: 'transform 0.15s ease',
  },
  tabActive: {
    transform: 'translateY(-1px)',
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 26,
    borderRadius: 12,
    transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  iconContainerActive: {
    background: 'rgba(124, 58, 237, 0.15)',
    filter: 'drop-shadow(0 0 8px rgba(167, 139, 250, 0.4))',
  },
  label: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    letterSpacing: '0.01em',
  },
  labelActive: {
    color: '#f1f5f9',
    fontWeight: 700,
  },
  activeIndicator: {
    position: 'absolute' as const,
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 24,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    background: 'linear-gradient(90deg, #7c3aed, #c084fc)',
    boxShadow: '0 2px 10px rgba(167, 139, 250, 0.6)',
  },
};
