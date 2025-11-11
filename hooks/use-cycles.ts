"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { CycleDto } from "@/lib/types"
import { cycleApi } from "@/lib/api-endpoints"
import { useAuth } from "@/contexts/auth-context"

type LatLng = { lat: number; lng: number }

function normalize(c: any): CycleDto {
  const loc = c?.currentLocation
  if (loc && Array.isArray(loc.coordinates)) {
    const [lng, lat] = loc.coordinates // GeoJSON order
    return { ...c, currentLocation: { lat, lng } }
  }
  return c
}

export function useCycles() {
  const { isAuthenticated } = useAuth()
  const [cycles, setCycles] = useState<CycleDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastHashRef = useRef<string>("")

  const fetchCycles = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await cycleApi.getAll()
      const payload = (res as any)?.data?.data ?? (res as any)?.data ?? res
      const list: any[] = Array.isArray(payload?.cycles) ? payload.cycles : payload

      const normalized = (list || []).map(normalize)

      // Only update state if something actually changed (prevents no-op renders)
      const hash = JSON.stringify(
        normalized.map((c) => ({
          id: c.id ?? c.cycleId,
          lat: (c as any).currentLocation?.lat,
          lng: (c as any).currentLocation?.lng,
          available: c.available,
        }))
      )
      if (hash !== lastHashRef.current) {
        lastHashRef.current = hash
        setCycles(normalized as CycleDto[])
        // debug: console.debug("[use-cycles] updated", normalized.map(c => ({id: c.id ?? c.cycleId, ...c.currentLocation})))
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to load cycles"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchCycles()
    const pollMs =
      Number(process.env.NEXT_PUBLIC_CYCLES_POLL_MS ?? "") > 0
        ? Number(process.env.NEXT_PUBLIC_CYCLES_POLL_MS)
        : 3000 // faster so motion is visible
    const id = setInterval(fetchCycles, pollMs)
    return () => clearInterval(id)
  }, [fetchCycles])

  return { cycles, isLoading, error, fetchCycles,  refresh: fetchCycles }
}
