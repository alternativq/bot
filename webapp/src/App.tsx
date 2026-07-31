import { useState } from 'react';
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

  const navigate = (p: Page) => setPage(p);

  const goToPayment = (planId: string, methodId?: string) => {
    setPaymentCtx({ planId, methodId });
    setPage('payment');
  };

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
