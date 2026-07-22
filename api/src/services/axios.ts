import axios from "axios";

export const api = axios.create({
  baseURL: process.env.DELIVERY_BASE_API,
  withCredentials: true,
  headers : {
    authorization : `BEARER ${process.env.DELIVERY_API_KEY}`
  }
});
