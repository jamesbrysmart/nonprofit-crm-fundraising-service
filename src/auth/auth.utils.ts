import type { Request } from 'express';

const getHeaderValue = (
  headerValue: string | string[] | undefined,
): string | undefined => {
  if (!headerValue) {
    return undefined;
  }
  if (Array.isArray(headerValue)) {
    return headerValue.find((value) => value.trim().length > 0);
  }
  const trimmed = headerValue.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getQueryToken = (request: Request): string | undefined => {
  const rawToken = request.query?.token;
  if (typeof rawToken === 'string') {
    const trimmed = rawToken.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(rawToken)) {
    for (const item of rawToken) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }
  return undefined;
};

export const extractAccessToken = (request: Request): string | undefined => {
  const headerValue = getHeaderValue(request.headers.authorization);
  if (headerValue) {
    const match = /^Bearer\s+(.+)$/i.exec(headerValue);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return getQueryToken(request);
};

export const isAuthExemptRequest = (request: Request): boolean => {
  if (request.method === 'OPTIONS') {
    return true;
  }
  return request.path.startsWith('/webhooks');
};

const getCookieValue = (
  headerValue: string | undefined,
  name: string,
): string | undefined => {
  if (!headerValue) {
    return undefined;
  }
  const cookies = headerValue.split(';');
  for (const cookie of cookies) {
    const [rawKey, ...rawValueParts] = cookie.split('=');
    if (!rawKey) {
      continue;
    }
    if (rawKey.trim() === name) {
      const rawValue = rawValueParts.join('=').trim();
      return rawValue.length > 0 ? rawValue : undefined;
    }
  }
  return undefined;
};

const parseTokenPairCookie = (value: string): unknown => {
  try {
    const decoded = decodeURIComponent(value);
    return JSON.parse(decoded);
  } catch {
    return undefined;
  }
};

const hasTokenPairToken = (tokenPair: unknown): boolean => {
  if (!tokenPair || typeof tokenPair !== 'object') {
    return false;
  }
  const payload = tokenPair as {
    accessOrWorkspaceAgnosticToken?: { token?: unknown };
    refreshToken?: { token?: unknown };
  };
  const accessToken = payload.accessOrWorkspaceAgnosticToken?.token;
  const refreshToken = payload.refreshToken?.token;
  return (
    (typeof accessToken === 'string' && accessToken.trim().length > 0) ||
    (typeof refreshToken === 'string' && refreshToken.trim().length > 0)
  );
};

export const hasFundraisingSession = (request: Request): boolean => {
  if (extractAccessToken(request)) {
    return true;
  }
  const cookieHeader = getHeaderValue(request.headers.cookie);
  const tokenPairValue = getCookieValue(cookieHeader, 'tokenPair');
  if (!tokenPairValue) {
    return false;
  }
  return hasTokenPairToken(parseTokenPairCookie(tokenPairValue));
};
