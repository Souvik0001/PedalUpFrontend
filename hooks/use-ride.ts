"use client"

// Hook for managing active ride state and operations
import { useState, useCallback } from "react"
import type { RideDto, RideStatusDto } from "@/lib/types"
import { rideApi } from "@/lib/api-endpoints"

export function useRide() {
  const [activeRide, setActiveRide] = useState<RideDto | null>(null)
  const [rideStatus, setRideStatus] = useState<RideStatusDto | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestRide = useCallback(
    async (cycleId: string, data?: { pickupLat?: number; pickupLng?: number; notes?: string }) => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await rideApi.requestRide(cycleId, data)
        console.log("[v0] Ride requested:", response.data)
        return response.data
      } catch (err: any) {
        const message = err.response?.data?.message || err.message
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const acceptRide = useCallback(async (rideRequestId: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await rideApi.acceptRide(rideRequestId)
      setActiveRide(response.data)
      console.log("[v0] Ride accepted:", response.data)
      return response.data
    } catch (err: any) {
      const message = err.response?.data?.message || err.message
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getRideStatus = useCallback(async (rideId: number) => {
    try {
      const response = await rideApi.getRideStatus(rideId)
      setRideStatus(response.data)
      console.log("[v0] Ride status:", response.data)
      return response.data
    } catch (err: any) {
      console.error("[v0] Error fetching ride status:", err)
      throw err
    }
  }, [])

  const endRide = useCallback(async (rideId: number, data?: { endLat?: number; endLng?: number }) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await rideApi.endRide(rideId, data)
      setActiveRide(null)
      console.log("[v0] Ride ended:", response.data)
      return response.data
    } catch (err: any) {
      const message = err.response?.data?.message || err.message
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    activeRide,
    rideStatus,
    isLoading,
    error,
    requestRide,
    acceptRide,
    getRideStatus,
    endRide,
    clearError,
    setActiveRide,
  }
}
