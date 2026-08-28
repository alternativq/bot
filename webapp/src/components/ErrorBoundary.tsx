import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#070709',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: '#ffffff' }}>
            Ошибка загрузки интерфейса
          </h2>
          <p style={{ fontSize: 13, color: '#90909c', maxWidth: 360, margin: '0 0 20px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'Произошла ошибка при инициализации.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#8b5cf6',
              color: '#ffffff',
              border: 'none',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            🔄 Перезагрузить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
