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

  // Loading check
  if (isTelegram === null) return null;

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
    backgroundColor: '#0a0a14',
    padding: 20,
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  card: {
    backgroundColor: '#12121e',
    padding: 32,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    textAlign: 'center' as const,
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#eaeaff',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#6b6b8d',
    lineHeight: '1.5',
  },
};
