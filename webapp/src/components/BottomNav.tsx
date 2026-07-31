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
            <span style={styles.icon}>{tab.icon}</span>
            <span
              style={{
                ...styles.label,
                ...(isActive ? styles.labelActive : {}),
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 'var(--nav-height)',
    paddingBottom: 'var(--safe-bottom)',
    background: 'rgba(15, 15, 26, 0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid var(--glass-border)',
    zIndex: 100,
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    padding: '8px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.2s ease',
  },
  tabActive: {},
  icon: {
    fontSize: '20px',
    lineHeight: 1,
  },
  label: {
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    fontFamily: 'inherit',
    transition: 'color 0.2s ease',
  },
  labelActive: {
    color: 'var(--accent)',
    fontWeight: 600,
  },
};
