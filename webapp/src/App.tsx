import { useState, useEffect, lazy, Suspense } from 'react';
import './App.css';
import { BottomNav } from './components/BottomNav';
import { HomePage } from './pages/HomePage';
import { authenticate, getAuthToken, setAuthToken, getMe } from './api/client';
import type { UserProfile } from './types';

import { WebPortalPage } from './pages/WebPortalPage';

const FAQPage = lazy(() => import('./pages/FAQPage').then((m) => ({ default: m.FAQPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const PaymentPage = lazy(() => import('./pages/PaymentPage').then((m) => ({ default: m.PaymentPage })));
const PlansPage = lazy(() => import('./pages/PlansPage').then((m) => ({ default: m.PlansPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

export type Page =
  | 'home'
  | 'plans'
  | 'subscription'
  | 'history'
  | 'settings'
  | 'faq'
  | 'payment'
  | 'admin';

export interface PaymentContext {
  planId: string;
  methodId?: string;
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [paymentCtx, setPaymentCtx] = useState<PaymentContext | null>(null);
  const [isTelegram, setIsTelegram] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function initAuth() {
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          try {
            tg.ready();
            tg.expand();
          } catch (e) {}
        }

        const initData = tg?.initData || '';
        const isTelegramEnv = Boolean(
          tg &&
          (initData.length > 0 ||
           tg.initDataUnsafe?.user ||
           (tg.platform && tg.platform !== 'unknown') ||
           window.name?.includes('tgWebAppData'))
        );

        if (isTelegramEnv) {
          setIsTelegram(true);
          if (initData) {
            try {
              if (!getAuthToken()) {
                const { token } = await authenticate(initData);
                setAuthToken(token);
              }
              const userProfile = await getMe();
              setProfile(userProfile);
            } catch (err) {
              console.error('Auth initialization error:', err);
            }
          }
        } else {
          setIsTelegram(false);
        }
      } catch (err) {
        console.error('Fallback error:', err);
        setIsTelegram(false);
      }
    }
    initAuth();
  }, []);

  const navigate = (p: Page) => setPage(p);

  const goToPayment = (planId: string, methodId?: string) => {
    setPaymentCtx({ planId, methodId });
    setPage('payment');
  };

  // Web Emergency Access Portal for regular browsers outside Telegram
  if (isTelegram === false) {
    return <WebPortalPage />;
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
      case 'admin':
        return <AdminPage navigate={navigate} profile={profile} />;
      default:
        return <HomePage navigate={navigate} />;
    }
  };

  return (
    <>
      <Suspense
        fallback={
          <div className="page" style={{ paddingTop: 'calc(24px + env(safe-area-inset-top, 0px))' }}>
            <div className="skeleton" style={{ height: 160, borderRadius: 20, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 200, borderRadius: 20 }} />
          </div>
        }
      >
        {renderPage()}
      </Suspense>
      <BottomNav current={page} navigate={navigate} isAdmin={profile?.is_admin} />
    </>
  );
}

