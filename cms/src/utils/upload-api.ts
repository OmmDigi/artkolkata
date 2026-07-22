// lib/axios.ts
import axios from "axios";

const uploadApi = axios.create({
  baseURL:
    import.meta.env.VITE_API_UPLOAD_BASE_URL || "http://192.168.0.232:8081",
  headers: {
    "Content-Type": "multipart/form-data",
  },
  withCredentials: true,
});

export default uploadApi;
