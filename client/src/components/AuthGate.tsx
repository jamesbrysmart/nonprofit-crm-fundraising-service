import { useEffect, useState, type ReactNode } from 'react';
import {
  clearTokenPair,
  getTokenPair,
  refreshTokenPair,
  redirectToSignIn,
  setTokenPair,
  type AuthToken,
} from '../api-shared/auth';

type AuthGateStatus = 'checking' | 'ready';

const EXPIRY_BUFFER_MS = 30_000;

const parseExpiryFromIso = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const parseJwtExpiry = (token: string): number | null => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as { exp?: unknown };
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
};

const isTokenExpired = (token: AuthToken | undefined): boolean => {
  if (!token?.token) {
    return true;
  }
  const expiry = parseExpiryFromIso(token.expiresAt) ?? parseJwtExpiry(token.token);
  if (!expiry) {
    return true;
  }
  return expiry - EXPIRY_BUFFER_MS <= Date.now();
};

const AuthGateScreen = (): JSX.Element => (
  <div className="f-min-h-screen f-bg-canvas" aria-hidden="true" />
);

export function AuthGate({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<AuthGateStatus>('checking');

  useEffect(() => {
    let isActive = true;

    const validateSession = async () => {
      const tokenPair = getTokenPair();
      const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken;
      const refreshToken = tokenPair?.refreshToken;

      if (accessToken && !isTokenExpired(accessToken)) {
        if (isActive) {
          setStatus('ready');
        }
        return;
      }

      if (!refreshToken?.token) {
        clearTokenPair();
        redirectToSignIn();
        return;
      }

      try {
        const refreshed = await refreshTokenPair();
        if (refreshed?.accessOrWorkspaceAgnosticToken?.token) {
          setTokenPair(refreshed);
          if (isActive) {
            setStatus('ready');
          }
          return;
        }
      } catch {
        // Fall through to redirect when refresh fails.
      }

      clearTokenPair();
      redirectToSignIn();
    };

    void validateSession();

    return () => {
      isActive = false;
    };
  }, []);

  if (status !== 'ready') {
    return <AuthGateScreen />;
  }

  return <>{children}</>;
}
