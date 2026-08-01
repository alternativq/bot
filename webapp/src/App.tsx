import { useState, useEffect } from 'react';
import './App.css';
import { BottomNav } from './components/BottomNav';
import { FAQPage } from './pages/FAQPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { PaymentPage } from './pages/PaymentPage';
import { PlansPage } from './pages/PlansPage';
import { SettingsPage } from './pages/SettingsPage';
import { SubscriptionPage } from './pages/SubscriptionPage';

export type Page =
  | 'home'
  | 'plans'
  | 'subscription'
  | 'history'
  | 'settings'
  | 'faq'
  | 'payment';

export interface PaymentContext {
  planId: string;
  methodId?: string;
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [paymentCtx, setPaymentCtx] = useState<PaymentContext | null>(null);
  const [isTelegram, setIsTelegram] = useState<boolean | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData && tg.initData.length > 0) {
      setIsTelegram(true);
    } else {
      setIsTelegram(false);
    }
  }, []);

  const navigate = (p: Page) => setPage(p);

  const goToPayment = (planId: string, methodId?: string) => {
    setPaymentCtx({ planId, methodId });
    setPage('payment');
  };

  // Stub for regular browsers
  if (isTelegram === false) {
    return (
      <div style={stubStyles.container}>
        <div style={stubStyles.card}>
          <h2 style={stubStyles.title}>Технические работы</h2>
          <p style={stubStyles.text}>
            Данный ресурс недоступен для прямого просмотра.
          </p>
        </div>
      </div>
    );
  }

  // Skeleton loading screen during initial Telegram initData check
  if (isTelegram === null) {
    return (
      <div className="page" style={{ paddingTop: 'calc(24px + env(safe-area-inset-top, 0px))' }}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skeleton" style={{ width: 140, height: 28, marginBottom: 8, borderRadius: 8 }} />
            <div className="skeleton" style={{ width: 90, height: 16, borderRadius: 6 }} />
          </div>
          <div className="skeleton" style={{ width: 70, height: 26, borderRadius: 100 }} />
        </div>

        <div className="skeleton" style={{ height: 200, marginBottom: 20, borderRadius: 20 }} />

        <div className="skeleton" style={{ width: 120, height: 16, marginBottom: 12, borderRadius: 6 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 18 }} />
          ))}
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <HomePage navigate={navigate} />;
      case 'plans':
        return <PlansPage navigate={navigate} goToPayment={goToPayment} />;
      case 'subscription':
        return <SubscriptionPage navigate={navigate} />;
      case 'history':
        return <HistoryPage navigate={navigate} />;
      case 'settings':
        return <SettingsPage navigate={navigate} />;
      case 'faq':
        return <FAQPage navigate={navigate} />;
      case 'payment':
        return (
          <PaymentPage
            navigate={navigate}
            planId={paymentCtx?.planId ?? ''}
            methodId={paymentCtx?.methodId}
          />
        );
      default:
        return <HomePage navigate={navigate} />;
    }
  };

  return (
    <>
      {renderPage()}
      <BottomNav current={page} navigate={navigate} />
    </>
  );
}

const stubStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#070812',
    padding: 20,
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
  },
  card: {
    backgroundColor: 'rgba(18, 20, 38, 0.9)',
    padding: 32,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
    textAlign: 'center' as const,
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f1f5f9',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#8b92b2',
    lineHeight: '1.5',
  },
};
