import axios, { AxiosInstance, AxiosResponse } from "axios";

// ==================== API INSTANCE ====================

const API: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: {
    "ngrok-skip-browser-warning": "true",
    "Content-Type": "application/json",
  },
});

import { useUserStore } from "@/store/useUserStore";

// Read the token fresh on every request instead of once at module load,
// so a login/logout after the app has already booted is picked up immediately.
API.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

// Intercept responses to handle 401/403 errors globally
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (typeof window !== "undefined") {
        try {
          useUserStore.getState().logout();
        } catch (e) {
          localStorage.removeItem("token");
        }
        if (window.location.pathname !== "/account") {
          window.location.href = "/account";
        }
      }
    }
    return Promise.reject(error);
  }
);

// Debug: Check base URL during development

// console.log("API BaseURL:", import.meta.env.VITE_PUBLIC_API_BASE_URL);

// ==================== REQUEST TYPES ====================
interface RequestConfig {
  url: string;
  body?: Record<string, unknown>;
}

interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success?: boolean;
}

// ==================== GET REQUEST ====================
export const getRequest = async <T = unknown,>(url: string): Promise<T> => {
  const response: AxiosResponse<T> = await API.get(url);
  return response.data;
};

// ==================== POST REQUEST ====================
export const postRequest = async <T = unknown,>(
  config: RequestConfig
): Promise<T> => {
  const response: AxiosResponse<T> = await API.post(config.url, config.body);
  return response.data;
};

// ==================== PUT REQUEST ====================
// export const putRequest = async <T = unknown>(
//   config: RequestConfig
// ): Promise<T> => {
//   const response: AxiosResponse<T> = await API.put(config.url, config.body);
//   return response.data;
// };

// ==================== DELETE REQUEST ====================
export const deleteRequest = async <T = unknown>(config: RequestConfig): Promise<T> => {
  const response: AxiosResponse<T> = await API.delete(config.url, { data: config.body });
  return response.data;
};

// ==================== EXPORT API INSTANCE ====================
export default API;
export { API };
