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
      const res = await cycleApi.getAll()

      // Unwrap possible { data: [...] } response
      const payload: any = res?.data
      const list = Array.isArray(payload?.data)
        ? payload.data
        : (Array.isArray(payload) ? payload : [])

      // Normalize geometry: add { lat, lng } from coordinates [lng, lat]
      const normalized: CycleDto[] = list.map((c: any) => {
        const coords = c?.currentLocation?.coordinates
        if (Array.isArray(coords) && coords.length >= 2) {
          const lng = Number(coords[0])
          const lat = Number(coords[1])
          return {
            ...c,
            currentLocation: {
              ...c.currentLocation,
              lat,
              lng,
            },
          }
        }
        return c
      })

      setCycles(normalized)

      // handy debug if you want to inspect in DevTools
      if (typeof window !== "undefined") (window as any).pedalUpCycles = normalized
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to fetch cycles")
      setCycles([]) // keep array to avoid .filter crash elsewhere
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const getCycleById = useCallback(
    (id: string | number) => {
      const idNum = typeof id === "string" ? Number(id) : id
      return cycles.find((c) => c.id === idNum || c.cycleId === id)
    },
    [cycles]
  )

  useEffect(() => {
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
