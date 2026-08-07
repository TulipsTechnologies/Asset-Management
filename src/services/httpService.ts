import { TContentType } from "@/interface/IHttpService";
import { buildApiUrl, getApiBaseUrl } from "@/utils/constants";
import cookies from "js-cookie";
import {
  ASSET_LOGIN_ENDPOINT,
  clearAssetToken,
  ensureAssetToken,
  getAssetToken,
} from "./assetToken";

/**
 * Same requestApi conventions as the employee module, pointed at the
 * AssetManagement API (same-origin + NEXT_PUBLIC_API_BASE + '/api').
 */
export const requestApi = async ({
  apiEndpoint,
  baseUrl = null,
  acceptLanguage = "en",
  body = null,
  revalidate = null,
  contentType, // Note: setting a default breaks multipart form data
  completeData = false,
  method = "POST",
  token = null,
  signal = null,
  removeCache = true,
  returnBlob = false,
  externalApi = false,
  noAuth = false,
  _retried = false,
}: {
  apiEndpoint: string;
  baseUrl?: string | null;
  acceptLanguage?: string | null;
  body?: BodyInit | null;
  revalidate?: number | false | null;
  contentType?: TContentType;
  completeData?: boolean;
  method?: "POST" | "GET" | "PATCH" | "DELETE" | "PUT";
  token?: string | null;
  signal?: AbortSignal | null | undefined;
  removeCache?: boolean;
  returnBlob?: boolean;
  externalApi?: boolean;
  /** Skip the Authorization header entirely — for endpoints that authenticate
   *  from the request body (e.g. the HRM token exchange). */
  noAuth?: boolean;
  /** Internal: set after a single 401 re-exchange retry. */
  _retried?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any> => {
  const options: RequestInit = {
    method: method,
    cache: removeCache ? "no-cache" : "default",
  };

  if (signal) {
    options.signal = signal;
  }

  if (body) {
    options.body = body;
  }

  const defaultToken = getAssetToken() ?? "";

  if (!noAuth && (token || defaultToken)) {
    options.headers = {
      ...options.headers,
      Authorization: token ?? `Bearer ${defaultToken}`,
    };
  }

  if (acceptLanguage) {
    options.headers = {
      ...options.headers,
      "Accept-Language": acceptLanguage,
    };
  }

  // Active tenant. The API stamps CompanyId on writes from this header and
  // rejects writes when no tenant can be resolved (internal users carry no
  // company claim of their own).
  const activeCompanyId = cookies.get("ActiveCompanyId");
  if (activeCompanyId) {
    options.headers = {
      ...options.headers,
      "x-company-id": activeCompanyId,
    };
  }

  if (contentType) {
    options.headers = {
      ...options.headers,
      "Content-Type": contentType,
    };
  }

  if (revalidate) {
    options.next = {
      revalidate,
    };
  }

  let url = "";

  if (externalApi) {
    url = apiEndpoint;
  } else {
    url = buildApiUrl(apiEndpoint, baseUrl);
  }

  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    // Network-level failure: API down, wrong NEXT_PUBLIC_API_BASE, or CORS.
    // Surface it as a normal envelope so callers show a message instead of
    // throwing an unhandled "TypeError: Failed to fetch".
    const message = `Unable to reach the server at ${
      baseUrl ?? getApiBaseUrl()
    }. Check that the API is running and reachable.`;

    if (returnBlob) throw new Error(message);

    return {
      success: false,
      statusCode: 0,
      message,
      data: null,
    };
  }

  // Handle blob response (file downloads)
  if (returnBlob) {
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res;
  }

  if (res.status === 401) {
    const isLoginCall = apiEndpoint === ASSET_LOGIN_ENDPOINT;
    // Re-exchange once (skip the login endpoint itself to avoid a loop), then
    // retry the original request with the fresh asset token.
    // An intentionally anonymous request cannot be helped by a re-exchange —
    // the replay would deliberately send no token either.
    if (!isLoginCall && !_retried && !token && !noAuth) {
      const { token: refreshed } = await ensureAssetToken(true);
      if (refreshed) {
        return requestApi({
          apiEndpoint,
          baseUrl,
          acceptLanguage,
          body,
          revalidate,
          contentType,
          completeData,
          method,
          token: null,
          signal,
          removeCache,
          returnBlob,
          externalApi,
          noAuth,
          _retried: true,
        });
      }
    }

    // The hub owns `AuthToken`; only the module-scoped token is ours to drop.
    clearAssetToken();
    return {
      success: false,
      statusCode: 401,
      message: "Unauthorized",
    };
  }

  // Parse response
  const contentTypeHeader = res.headers.get("content-type");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  if (contentTypeHeader?.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  // Error responses with envelope bodies (400, 422, ...)
  if (!res.ok && res.status !== 204) {
    if (data && typeof data === "object") {
      return data;
    }

    if (
      contentTypeHeader &&
      contentTypeHeader.includes("application/problem+json")
    ) {
      throw new Error(data?.detail || data?.message || "An error occurred");
    }

    throw new Error(`HTTP error! status: ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) {
    return null;
  }

  if (data !== undefined && data !== null && data !== "") {
    if (completeData) {
      return data;
    }
    return data.data ?? data;
  }

  throw new Error("Invalid Response");
};
