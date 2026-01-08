import {
  clearTokenPair,
  getAccessToken,
  refreshTokenPair,
  redirectToSignIn,
  setTokenPair,
} from './auth';

export interface FetchJsonOptions {
  method?: string;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ApiErrorMetadata {
  url: string;
  method: string;
  status: number;
  statusText: string;
  body?: unknown;
  rawBody?: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly url: string;
  public readonly method: string;
  public readonly body?: unknown;
  public readonly rawBody?: string;

  constructor(message: string, meta: ApiErrorMetadata) {
    super(message);
    this.name = 'ApiError';
    this.status = meta.status;
    this.statusText = meta.statusText;
    this.url = meta.url;
    this.method = meta.method;
    this.body = meta.body;
    this.rawBody = meta.rawBody;
  }
}

const buildQueryString = (params?: Record<string, unknown>): string | undefined => {
  if (!params) {
    return undefined;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      query.set(key, value.join(','));
      continue;
    }
    const stringValue =
      typeof value === 'string'
        ? value.trim()
        : typeof value === 'number' && Number.isFinite(value)
          ? value.toString()
          : typeof value === 'boolean'
            ? String(value)
            : '';
    if (stringValue.length > 0) {
      query.set(key, stringValue);
    }
  }

  const serialized = query.toString();
  return serialized.length > 0 ? serialized : undefined;
};

const serializeBody = (
  body: unknown,
  headers: Record<string, string>,
): BodyInit | undefined => {
  if (body === undefined || body === null) {
    return undefined;
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer;
  const isUrlSearchParams =
    typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;

  if (isFormData || isBlob || isArrayBuffer || isUrlSearchParams) {
    return body;
  }

  if (typeof body === 'string') {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    return body;
  }

  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return JSON.stringify(body);
};

const addAuthorizationHeader = (
  headers: Record<string, string>,
): Record<string, string> => {
  if (headers.Authorization || headers.authorization) {
    return headers;
  }
  const token = getAccessToken();
  if (!token) {
    return headers;
  }
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
};

const fetchJsonInternal = async <T>(
  path: string,
  options: FetchJsonOptions,
  hasRefreshed: boolean,
): Promise<T> => {
  const method = options.method?.toUpperCase() ?? 'GET';

  const queryString = buildQueryString(options.params);
  const url = queryString ? `${path}?${queryString}` : path;

  const baseHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  const headers = addAuthorizationHeader(baseHeaders);

  const body = serializeBody(options.body, headers);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
    });
  } catch (error) {
    throw new ApiError('Network request failed', {
      url,
      method,
      status: 0,
      statusText: 'NETWORK_ERROR',
      rawBody: error instanceof Error ? error.message : undefined,
    });
  }

  let rawBody: string | undefined;
  let parsedBody: unknown = undefined;
  try {
    rawBody = await response.text();
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = undefined;
      }
    }
  } catch {
    rawBody = undefined;
  }

  if (!response.ok) {
    if (response.status === 401 && !hasRefreshed) {
      const refreshed = await refreshTokenPair();
      if (refreshed?.accessOrWorkspaceAgnosticToken?.token) {
        setTokenPair(refreshed);
        return fetchJsonInternal<T>(path, options, true);
      }
      clearTokenPair();
      redirectToSignIn();
    }
    const messageFromBody =
      typeof parsedBody === 'object' && parsedBody !== null
        ? ('message' in (parsedBody as Record<string, unknown>) &&
            typeof (parsedBody as Record<string, unknown>).message === 'string'
            ? (parsedBody as Record<string, unknown>).message
            : undefined)
        : undefined;

    const message = messageFromBody || rawBody || response.statusText || 'Request failed';

    throw new ApiError(message, {
      url,
      method,
      status: response.status,
      statusText: response.statusText,
      body: parsedBody,
      rawBody,
    });
  }

  if (!rawBody) {
    return undefined as T;
  }

  if (parsedBody === undefined) {
    throw new ApiError('Response was not valid JSON', {
      url,
      method,
      status: response.status,
      statusText: response.statusText,
      rawBody,
    });
  }

  return parsedBody as T;
};

export async function fetchJson<T>(
  path: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  return fetchJsonInternal<T>(path, options, false);
}
