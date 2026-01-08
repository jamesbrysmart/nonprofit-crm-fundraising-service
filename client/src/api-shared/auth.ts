export interface AuthToken {
  token: string;
  expiresAt?: string;
}

export interface TokenPair {
  accessOrWorkspaceAgnosticToken?: AuthToken;
  refreshToken?: AuthToken;
}

type TokenPairPayload = {
  accessOrWorkspaceAgnosticToken?: {
    token?: unknown;
    expiresAt?: unknown;
  };
  refreshToken?: {
    token?: unknown;
    expiresAt?: unknown;
  };
};

const TOKEN_PAIR_COOKIE = 'tokenPair';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const buildToken = (value: unknown): AuthToken | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as { token?: unknown; expiresAt?: unknown };
  if (!isNonEmptyString(candidate.token)) {
    return undefined;
  }
  return {
    token: candidate.token.trim(),
    ...(isNonEmptyString(candidate.expiresAt)
      ? { expiresAt: candidate.expiresAt.trim() }
      : {}),
  };
};

const getCookieValue = (name: string): string | undefined => {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const cookieString = document.cookie;
  if (!cookieString) {
    return undefined;
  }
  const cookies = cookieString.split(';');
  for (const cookie of cookies) {
    const [rawKey, ...rawValueParts] = cookie.split('=');
    if (!rawKey) {
      continue;
    }
    if (rawKey.trim() === name) {
      const rawValue = rawValueParts.join('=').trim();
      if (!rawValue) {
        return undefined;
      }
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }
  return undefined;
};

const buildCookieAttributes = (): string => {
  const attributes = ['Path=/', 'SameSite=Lax'];
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    attributes.push('Secure');
  }
  return attributes.join('; ');
};

export const getTokenPair = (): TokenPair | undefined => {
  const raw = getCookieValue(TOKEN_PAIR_COOKIE);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as TokenPairPayload;
    const accessToken = buildToken(parsed?.accessOrWorkspaceAgnosticToken);
    const refreshToken = buildToken(parsed?.refreshToken);
    if (!accessToken && !refreshToken) {
      return undefined;
    }
    return {
      ...(accessToken ? { accessOrWorkspaceAgnosticToken: accessToken } : {}),
      ...(refreshToken ? { refreshToken } : {}),
    };
  } catch {
    return undefined;
  }
};

export const setTokenPair = (tokenPair: TokenPair): void => {
  if (typeof document === 'undefined') {
    return;
  }
  const serialized = JSON.stringify(tokenPair);
  const encoded = encodeURIComponent(serialized);
  document.cookie = `${TOKEN_PAIR_COOKIE}=${encoded}; ${buildCookieAttributes()}`;
};

export const clearTokenPair = (): void => {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${TOKEN_PAIR_COOKIE}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${buildCookieAttributes()}`;
};

export const getAccessToken = (): string | undefined =>
  getTokenPair()?.accessOrWorkspaceAgnosticToken?.token;

const RENEW_TOKEN_MUTATION = `
  mutation RenewToken($appToken: String!) {
    renewToken(appToken: $appToken) {
      tokens {
        accessOrWorkspaceAgnosticToken {
          token
          expiresAt
        }
        refreshToken {
          token
          expiresAt
        }
      }
    }
  }
`;

let refreshPromise: Promise<TokenPair | null> | null = null;

export const refreshTokenPair = async (): Promise<TokenPair | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getTokenPair()?.refreshToken?.token;
  if (!refreshToken) {
    return null;
  }

  refreshPromise = (async () => {
    const response = await fetch('/graphql', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: RENEW_TOKEN_MUTATION,
        variables: { appToken: refreshToken },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      data?: { renewToken?: { tokens?: TokenPairPayload } };
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors && payload.errors.length > 0) {
      return null;
    }

    const tokens = payload.data?.renewToken?.tokens;
    if (!tokens) {
      return null;
    }

    const accessToken = buildToken(tokens.accessOrWorkspaceAgnosticToken);
    const refreshedToken = buildToken(tokens.refreshToken);
    if (!accessToken) {
      return null;
    }

    return {
      accessOrWorkspaceAgnosticToken: accessToken,
      ...(refreshedToken ? { refreshToken: refreshedToken } : {}),
    };
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

export const redirectToSignIn = (redirectPath?: string): void => {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL('/welcome', window.location.origin);
  const destination =
    redirectPath ?? `${window.location.pathname}${window.location.search}`;
  if (destination) {
    url.searchParams.set('redirect', destination);
  }
  window.location.assign(url.toString());
};
