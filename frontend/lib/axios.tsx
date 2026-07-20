import axios from "axios";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL, // 💥 read from .env
  headers: {
    "ngrok-skip-browser-warning": "true",
    "Content-Type": "application/json",
  },
  withCredentials: true, // changed to true as backend uses cookies
});

export default axiosInstance;
