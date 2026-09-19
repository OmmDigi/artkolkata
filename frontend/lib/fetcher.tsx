import { useUserStore } from "@/hooks/useUserStore";
import axios, { AxiosInstance, AxiosResponse } from "axios";

// ==================== API INSTANCE ====================

const API: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: {
    "ngrok-skip-browser-warning": "true",
    "Content-Type": "application/json",
  },
});

// Read the token fresh on every request instead of once at module load,
// so a login/logout after the app has already booted is picked up immediately.
API.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

/**
 * A 401/403 ends the session — but only if there was a session to end.
 *
 * A guest has no token, so an authenticated endpoint answering 401 to them is
 * the expected answer, not an expired login. Logging out on it anyway ran
 * useUserStore.logout(), which calls resetLocalCart(), which deletes the
 * browser copy of the cart. A guest who opened checkout (where the profile
 * request 401s) therefore watched their cart empty itself. Checking for a
 * token first keeps the logout for the case it was written for: a token that
 * the API has stopped accepting.
 */
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401 || status === 403) {
      if (typeof window !== "undefined" && localStorage.getItem("token")) {
        try {
          useUserStore.getState().logout();
        } catch {
          localStorage.removeItem("token");
        }
        // if (window.location.pathname !== "/account") {
        //   window.location.href = "/account";
        // }
      }
    }
    return Promise.reject(error);
  },
);

// Debug: Check base URL during development

// console.log("API BaseURL:", import.meta.env.VITE_PUBLIC_API_BASE_URL);

// ==================== REQUEST TYPES ====================
interface RequestConfig {
  url: string;
  body?: Record<string, unknown>;
  // Per-request headers, merged on top of the instance defaults. Used by
  // checkout to attach an Idempotency-Key.
  headers?: Record<string, string>;
}

interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success?: boolean;
}

// ==================== GET REQUEST ====================
// headers are optional and merged on top of the instance defaults, the same
// way postRequest does it — the guest order page uses them to present its
// order token, which is not a login and so never goes in Authorization.
export const getRequest = async <T = unknown,>(
  url: string,
  headers?: Record<string, string>,
): Promise<T> => {
  const response: AxiosResponse<T> = await API.get(url, { headers });
  return response.data;
};

// ==================== POST REQUEST ====================
export const postRequest = async <T = unknown,>(
  config: RequestConfig,
): Promise<T> => {
  const response: AxiosResponse<T> = await API.post(config.url, config.body, {
    headers: config.headers,
  });
  return response.data;
};

// ==================== PUT REQUEST ====================
// export const putRequest = async <T = unknown>(
//   config: RequestConfig
// ): Promise<T> => {
//   const response: AxiosResponse<T> = await API.put(config.url, config.body);
//   return response.data;
// };

// ==================== PATCH REQUEST ====================
// the cart quantity stepper sends the number it wants, not a delta
export const patchRequest = async <T = unknown,>(
  config: RequestConfig,
): Promise<T> => {
  const response: AxiosResponse<T> = await API.patch(config.url, config.body, {
    headers: config.headers,
  });
  return response.data;
};

// ==================== DELETE REQUEST ====================
export const deleteRequest = async <T = unknown,>(
  config: RequestConfig,
): Promise<T> => {
  const response: AxiosResponse<T> = await API.delete(config.url, {
    data: config.body,
  });
  return response.data;
};

// ==================== EXPORT API INSTANCE ====================
export default API;
export { API };
