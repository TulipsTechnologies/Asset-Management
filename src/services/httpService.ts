import { TContentType } from "@/interface/IHttpService";
import { API_PREFIX, getBaseUrl } from "@/utils/constants";
import cookies from "js-cookie";

/**
 * Same requestApi conventions as the employee module, pointed at the
 * VehicleManagement API (getBaseUrl() + '/api').
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

  const defaultToken = cookies.get("AuthToken") ?? "";

  if (token || defaultToken) {
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
    url = `${baseUrl ?? getBaseUrl()}${API_PREFIX}${apiEndpoint}`;
  }

  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    // Network-level failure: API down, wrong NEXT_PUBLIC_API_BASE, or CORS.
    // Surface it as a normal envelope so callers show a message instead of
    // throwing an unhandled "TypeError: Failed to fetch".
    const message = `Unable to reach the server at ${
      baseUrl ?? getBaseUrl()
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
    cookies.remove("AuthToken");
    cookies.remove("user");
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
