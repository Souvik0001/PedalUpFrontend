"use client"

// Hook for fetching and managing cycle data
import { useState, useEffect, useCallback } from "react"
import type { CycleDto } from "@/lib/types"
import { cycleApi } from "@/lib/api-endpoints"
import { useAuth } from "@/contexts/auth-context"

export function useCycles() {
  const [cycles, setCycles] = useState<CycleDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isAuthenticated } = useAuth()

  const fetchCycles = useCallback(async () => {
    if (!isAuthenticated) return

    setIsLoading(true)
    setError(null)
    try {
      console.log("[v0] Fetching cycles...")
      const response = await cycleApi.getAll()
      console.log("[v0] Cycles fetched successfully:", response.data.length)
      setCycles(response.data)
    } catch (err: any) {
      const errorMessage =
        err.response?.status === 401
          ? "Session expired. Please login again."
          : err.response?.status === 500
            ? "Server error. Please try again later."
            : err.message || "Failed to load cycles"

      setError(errorMessage)
      console.error("[v0] Error fetching cycles:", err.response?.status, err.message)

      // Only clear if it's an auth error, let the api-client handle the 401 redirect
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const getCycleById = useCallback(async (id: number) => {
    try {
      const response = await cycleApi.getById(id)
      return response.data
    } catch (err) {
      console.error("[v0] Error fetching cycle:", err)
      throw err
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setCycles([])
      setError(null)
      return
    }

    fetchCycles()
    const interval = setInterval(fetchCycles, 30000)
    return () => clearInterval(interval)
  }, [fetchCycles, isAuthenticated])

  return {
    cycles,
    isLoading,
    error,
    fetchCycles,
    getCycleById,
  }
}
