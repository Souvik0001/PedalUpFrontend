"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { UserDto } from "@/lib/types"
import {
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  isTokenExpired,
  subscribeToTokenChanges,
} from "@/lib/api-client"
import { authApi } from "@/lib/api-endpoints"

interface AuthContextType {
  user: UserDto | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  signup: (name: string, email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  accessToken: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [accessToken, setAccessTokenState] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("accessToken")
      if (storedToken && !isTokenExpired()) {
        setAccessTokenState(storedToken)
        console.log("[v0] Loaded token from localStorage on mount")
      } else if (storedToken) {
        console.log("[v0] Stored token is expired, clearing...")
        clearAccessToken()
      }
    }

    // Subscribe to token changes
    const unsubscribe = subscribeToTokenChanges((token) => {
      console.log("[v0] Token changed in api-client, updating state:", !!token)
      setAccessTokenState(token)
    })

    // Check initial token via getter (supports both SSR and client)
    const initialToken = getAccessToken()
    if (initialToken && !isTokenExpired()) {
      setAccessTokenState(initialToken)
      console.log("[v0] Initial token found")
    }

    setIsInitialized(true)

    // Token refresh check interval
    const checkTokenExpiry = setInterval(() => {
      const currentToken = getAccessToken()
      if (currentToken && isTokenExpired()) {
        console.log("[v0] Token expiring soon, refreshing...")
        authApi
          .refresh()
          .then((response) => {
            const newToken = response.data.data?.accessToken
            if (newToken) {
              setAccessToken(newToken, 3600)
              console.log("[v0] Token refreshed successfully")
            }
          })
          .catch((error) => {
            console.log("[v0] Token refresh failed (this is OK, will retry later):", error.message)
            // Don't logout here - let the user continue using the app
            // The API interceptor will handle 401 errors when they actually occur
          })
      }
    }, 30000)

    return () => {
      clearInterval(checkTokenExpiry)
      unsubscribe()
    }
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true)
    try {
      await authApi.signup({ name, email, password })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      console.log("[v0] Login attempt with email:", email)
      const response = await authApi.login({ email, password })
      console.log("[v0] Login response received:", response.data)

      const apiResponse = response.data as any
      const token = apiResponse.data?.accessToken

      console.log("[v0] Extracted token:", !!token)

      if (!token) {
        throw new Error("Login failed: API returned empty token. Check API response structure.")
      }

      const expiresIn = 3600

      // Create a basic user object from the email since the API doesn't return user data
      const userData: UserDto = {
        id: 0, // Will be updated when user profile is fetched
        name: email.split("@")[0],
        email: email,
        roles: [],
      }

      // This avoids race conditions where redirect happens before subscription callback
      setAccessToken(token, expiresIn)
      setAccessTokenState(token)
      setUser(userData)
      console.log("[v0] Login successful, token stored and state updated immediately")
    } catch (err) {
      console.log("[v0] Login error:", err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await authApi.logout()
    } catch (error) {
      console.log("[v0] Logout API call failed, clearing local state anyway")
    } finally {
      clearAccessToken()
      setUser(null)
      setIsLoading(false)
    }
  }, [])

  const value: AuthContextType = {
    user,
    isAuthenticated: !!accessToken,
    isLoading,
    isInitialized,
    signup,
    login,
    logout,
    accessToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
