// Axios instance with token refresh interceptor (Next.js friendly)
import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from "axios"
import type { AuthResponse } from "./types"

// Next.js exposes only NEXT_PUBLIC_* vars to the browser
// Put in .env.local: NEXT_PUBLIC_API_BASE=http://localhost:3001
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001").trim()

// Small runtime log so you can verify in DevTools
if (typeof window !== "undefined") {
  console.log("[PedalUp] API base:", API_BASE)
  ;(window as any).__PEDALUP_API_BASE__ = API_BASE
}

let tokenExpiresAt: number | null = null
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []
let tokenChangeCallbacks: Array<(token: string | null) => void> = []

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback)
}
const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

export const subscribeToTokenChanges = (callback: (token: string | null) => void) => {
  tokenChangeCallbacks.push(callback)
  return () => {
    tokenChangeCallbacks = tokenChangeCallbacks.filter((cb) => cb !== callback)
  }
}
const notifyTokenChange = (token: string | null) => {
  tokenChangeCallbacks.forEach((cb) => cb(token))
}

// Always go through the proxy (3001) so cookies/refresh work
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
})

// Add bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
    if (token && config.url && !config.url.includes("/auth/login") && !config.url.includes("/auth/signup")) {
      config.headers = config.headers ?? {}
      ;(config.headers as any).Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 401 → try refresh → retry once
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              (originalRequest.headers as any).Authorization = `Bearer ${token}`
            }
            resolve(apiClient(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true
      try {
        const resp = await axios.post<AuthResponse>(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
        const newToken = resp.data?.data?.accessToken
        if (!newToken) throw new Error("Token refresh failed: no accessToken in response")

        setAccessToken(newToken, 3600)
        onTokenRefreshed(newToken)

        if (originalRequest.headers) {
          (originalRequest.headers as any).Authorization = `Bearer ${newToken}`
        }
        return apiClient(originalRequest)
      } catch (refreshError) {
        clearAccessToken()
        if (typeof window !== "undefined") window.location.href = "/login"
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

// ===== Token helpers =====
export const setAccessToken = (token: string, fallbackTtlSec = 3600) => {
  if (!token || typeof window === "undefined") return

  // derive exp from JWT if present
  const parseJwtExpMs = (t: string): number | null => {
    try {
      const payload = JSON.parse(atob(t.split(".")[1]))
      if (payload && typeof payload.exp === "number") return payload.exp * 1000
    } catch {}
    return null
  }

  const expMsFromJwt = parseJwtExpMs(token)
  const expiresAt =
    expMsFromJwt && expMsFromJwt > Date.now() ? expMsFromJwt : Date.now() + fallbackTtlSec * 1000

  localStorage.setItem("accessToken", token)
  localStorage.setItem("tokenExpiresAt", String(expiresAt))
  tokenExpiresAt = expiresAt
  notifyTokenChange(token)
}

export const getAccessToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem("accessToken")

export const clearAccessToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken")
    localStorage.removeItem("tokenExpiresAt")
    tokenExpiresAt = null
    notifyTokenChange(null)
    console.log("[v0] Token cleared from localStorage")
  }
}

export const isTokenExpired = () => {
  if (typeof window === "undefined") return true
  const s = localStorage.getItem("tokenExpiresAt")
  if (!s) return true
  const expiresAt = Number.parseInt(s, 10)
  const earlyRefreshBufferMs = 30_000
  return Date.now() >= expiresAt - earlyRefreshBufferMs
}

export default apiClient
