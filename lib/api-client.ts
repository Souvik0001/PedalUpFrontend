// Axios instance with token refresh interceptor
import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from "axios"
import type { AuthResponse } from "./types"

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8080"

let tokenExpiresAt: number | null = null
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []
let tokenChangeCallbacks: Array<(token: string | null) => void> = []

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback)
}

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token))
  refreshSubscribers = []
}

export const subscribeToTokenChanges = (callback: (token: string | null) => void) => {
  tokenChangeCallbacks.push(callback)
  return () => {
    tokenChangeCallbacks = tokenChangeCallbacks.filter((cb) => cb !== callback)
  }
}

const notifyTokenChange = (token: string | null) => {
  tokenChangeCallbacks.forEach((callback) => callback(token))
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for cookie-based refresh
})

// Request interceptor: add access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
    if (token && config.url && !config.url.includes("/auth/login") && !config.url.includes("/auth/signup")) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Response interceptor: handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // Token refresh in progress, queue this request
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            resolve(apiClient(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post<AuthResponse>(
          `${API_BASE}/auth/refresh`,
          {},
          {
            withCredentials: true, // Send refreshToken cookie
          },
        )

        const newToken = response.data.data?.accessToken
        if (newToken) {
          setAccessToken(newToken, 3600) // Default 1 hour expiry
          onTokenRefreshed(newToken)

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
          }
          return apiClient(originalRequest)
        } else {
          throw new Error("Token refresh failed: no accessToken in response")
        }
      } catch (refreshError) {
        console.log("[v0] Token refresh failed on 401 error, redirecting to login")
        clearAccessToken()
        if (typeof window !== "undefined") {
          window.location.href = "/login"
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export const setAccessToken = (token: string, expiresIn: number) => {
  console.log("[v0] setAccessToken called with token:", !!token, "expiresIn:", expiresIn)

  if (!token) {
    console.error("[v0] ERROR: Token is empty or undefined. Check API response structure.")
    return
  }

  if (typeof window !== "undefined") {
    localStorage.setItem("accessToken", token)
    localStorage.setItem("tokenExpiresAt", String(Date.now() + expiresIn))
    tokenExpiresAt = Date.now() + expiresIn
    notifyTokenChange(token)
    console.log("[v0] Token stored in localStorage, token present:", !!token, "expires at:", new Date(tokenExpiresAt))
  }
}

export const getAccessToken = () => {
  if (typeof window === "undefined") return null
  return localStorage.getItem("accessToken")
}

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
  const expiresAtStr = localStorage.getItem("tokenExpiresAt")
  if (!expiresAtStr) return true
  const expiresAt = Number.parseInt(expiresAtStr, 10)
  return Date.now() >= expiresAt - 300000 // Refresh 5 mins before expiry instead of 1
}

export default apiClient
