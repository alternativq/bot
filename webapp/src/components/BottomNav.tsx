import type { Page } from '../App';

interface BottomNavProps {
  current: Page;
  navigate: (page: Page) => void;
}

const tabs: Array<{ id: Page; label: string; icon: string }> = [
  { id: 'home', label: 'Главная', icon: '🏠' },
  { id: 'plans', label: 'Тарифы', icon: '📋' },
  { id: 'subscription', label: 'VPN', icon: '🔑' },
  { id: 'history', label: 'История', icon: '📜' },
  { id: 'settings', label: 'Ещё', icon: '⚙️' },
];

export function BottomNav({ current, navigate }: BottomNavProps) {
  return (
    <nav style={styles.nav}>
      <div style={styles.navInner}>
        {tabs.map((tab) => {
          const isActive = current === tab.id;
          return (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => navigate(tab.id)}
            >
              <span
                style={{
                  ...styles.icon,
                  ...(isActive ? styles.iconActive : {}),
                }}
              >
                {tab.icon}
              </span>
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
    background: 'rgba(8, 8, 16, 0.75)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
  },
  navInner: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 'var(--nav-height)',
    maxWidth: 480,
    margin: '0 auto',
    padding: '0 8px',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    padding: '8px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
    position: 'relative' as const,
  },
  tabActive: {},
  icon: {
    fontSize: '20px',
    lineHeight: 1,
    transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  iconActive: {
    transform: 'scale(1.15)',
    filter: 'drop-shadow(0 0 6px rgba(124, 108, 240, 0.4))',
  },
  label: {
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    fontFamily: 'inherit',
    transition: 'color 0.2s ease',
    letterSpacing: '0.02em',
  },
  labelActive: {
    color: '#a78bfa',
    fontWeight: 700,
  },
  activeIndicator: {
    position: 'absolute' as const,
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 20,
    height: 2,
    borderRadius: 2,
    background: 'linear-gradient(90deg, #7c6cf0, #c084fc)',
    boxShadow: '0 0 8px rgba(124, 108, 240, 0.5)',
  },
};
