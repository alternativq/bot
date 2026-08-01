/**
 * Хук для работы с Telegram Web App SDK.
 * Предоставляет доступ к объекту WebApp, данным пользователя и утилитам.
 */
import { useCallback, useEffect, useMemo } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };
    auth_date?: number;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;

  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;

  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };

  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };

  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };

  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{ id: string; type?: string; text?: string }>;
  }, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
}

export function useTelegram() {
  const tg = useMemo(() => window.Telegram?.WebApp, []);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, [tg]);

  const user = useMemo(() => tg?.initDataUnsafe?.user ?? null, [tg]);
  const initData = useMemo(() => tg?.initData ?? '', [tg]);
  const colorScheme = useMemo(() => tg?.colorScheme ?? 'dark', [tg]);

  const haptic = useCallback(
    (type: 'light' | 'medium' | 'heavy' = 'light') => {
      tg?.HapticFeedback?.impactOccurred(type);
    },
    [tg],
  );

  const showMainButton = useCallback(
    (text: string, onClick: () => void) => {
      if (!tg) return;
      tg.MainButton.setText(text);
      tg.MainButton.onClick(onClick);
      tg.MainButton.show();
    },
    [tg],
  );

  const hideMainButton = useCallback(() => {
    tg?.MainButton?.hide();
  }, [tg]);

  const showBackButton = useCallback(
    (onClick: () => void) => {
      if (!tg) return;
      tg.BackButton.onClick(onClick);
      tg.BackButton.show();
    },
    [tg],
  );

  const hideBackButton = useCallback(() => {
    tg?.BackButton?.hide();
  }, [tg]);

  return {
    tg,
    user,
    initData,
    colorScheme,
    haptic,
    showMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton,
  };
}
