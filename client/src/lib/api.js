import axios from "axios";

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
const normalizedBaseUrl =
  configuredBaseUrl === "" || configuredBaseUrl === "/"
    ? ""
    : configuredBaseUrl.replace(/\/+$/, "");

export const api = axios.create({
  baseURL: normalizedBaseUrl,
  withCredentials: true,
  timeout: 30000
});
