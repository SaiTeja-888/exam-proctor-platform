import axios from "axios";

export const API_BASE = "https://exam-proctor-platform.onrender.com";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem("admin_token");
  const candidateToken = localStorage.getItem("candidate_token");
  const token = adminToken || candidateToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function wsUrl(path: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}${path}`;
}

export function formatDate(value?: string): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
