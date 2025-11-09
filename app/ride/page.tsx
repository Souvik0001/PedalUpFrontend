// Active ride page
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useRide } from "@/hooks/use-ride"
import type { RideRequestDto } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import ActiveRideView from "@/components/active-ride-view"
import RideRequestStatus from "@/components/ride-request-status"
import { initializeSocket, sendCommand, onDeviceStatus, disconnectSocket } from "@/lib/socket-client"

export default function RidePage() {
  const router = useRouter()
  const { user, isAuthenticated, accessToken } = useAuth()
  const { activeRide, rideStatus, isLoading, error, endRide, getRideStatus, setActiveRide } = useRide()
  const [rideRequest, setRideRequest] = useState<RideRequestDto | null>(null)
  const [rideSummary, setRideSummary] = useState<any>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  // Initialize socket when component mounts
  useEffect(() => {
    if (accessToken && activeRide) {
      try {
        initializeSocket(accessToken)
        console.log("[v0] Socket initialized for ride updates")

        // Listen for device status updates
        const unsubscribe = onDeviceStatus((status) => {
          console.log("[v0] Received device status:", status)
        })

        return () => {
          unsubscribe()
        }
      } catch (error) {
        console.error("[v0] Error initializing socket:", error)
      }
    }

    return () => {
      disconnectSocket()
    }
  }, [accessToken, activeRide])

  // Poll ride status
  useEffect(() => {
    if (activeRide?.rideId) {
      const interval = setInterval(() => {
        getRideStatus(activeRide.rideId)
      }, 5000) // Poll every 5 seconds

      return () => clearInterval(interval)
    }
  }, [activeRide, getRideStatus])

  const handleEndRide = async () => {
    if (!activeRide?.rideId) return

    try {
      const summary = await endRide(activeRide.rideId, {
        endLat: rideStatus?.currentLocation.lat,
        endLng: rideStatus?.currentLocation.lng,
      })

      setRideSummary(summary)
      setMessage("Ride ended successfully!")

      // Redirect after showing summary
      setTimeout(() => router.push("/dashboard"), 3000)
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    }
  }

  const handleUnlock = () => {
    if (!activeRide?.rideId) return

    // Send unlock command via Socket.IO
    sendCommand({
      cycleId: activeRide.cycleId,
      command: "unlock",
      meta: {
        userId: user?.id,
        rideId: activeRide.rideId,
        reason: "user_requested",
      },
    })

    setMessage("Unlock command sent to cycle...")
  }

  if (rideSummary) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-foreground">Ride Summary</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <Card className="p-6">
            <div className="text-center mb-6">
              <div className="text-5xl mb-2">✓</div>
              <h2 className="text-2xl font-bold text-green-600">Ride Completed!</h2>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cycle:</span>
                <span className="font-semibold text-foreground">{rideSummary.cycleId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-semibold text-foreground">{Math.floor(rideSummary.durationSeconds / 60)}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-semibold text-foreground">{rideSummary.distanceKm?.toFixed(2)} km</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-border">
                <span className="text-muted-foreground">Amount:</span>
                <span className="text-xl font-bold text-primary">₹{rideSummary.amount?.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">Redirecting to dashboard...</p>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Your Ride</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {message && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-lg flex justify-between items-center">
            <span>{message}</span>
            <button onClick={() => setMessage("")} className="text-blue-800 dark:text-blue-200 hover:text-blue-900">
              ×
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {activeRide ? (
          <ActiveRideView
            ride={activeRide}
            rideStatus={rideStatus || undefined}
            onEndRide={handleEndRide}
            onUnlockClick={handleUnlock}
            isLoading={isLoading}
          />
        ) : rideRequest ? (
          <RideRequestStatus rideRequest={rideRequest} />
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No active ride. Return to dashboard to book a cycle.</p>
            <Button onClick={() => router.push("/dashboard")} className="bg-primary text-primary-foreground">
              Back to Dashboard
            </Button>
          </Card>
        )}
      </main>
    </div>
  )
}
