// Component showing active ride details and controls
"use client"

import { useState, useEffect } from "react"
import type { RideDto, RideStatusDto } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface ActiveRideViewProps {
  ride: RideDto
  onEndRide: () => Promise<void>
  isLoading?: boolean
  rideStatus?: RideStatusDto | null
  onUnlockClick?: () => void
}

export default function ActiveRideView({ ride, onEndRide, isLoading, rideStatus, onUnlockClick }: ActiveRideViewProps) {
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - ride.startTime) / 1000)
      setDuration(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [ride.startTime])

  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60

  const formatTime = (ms: number) => {
    const date = new Date(ms)
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Active Ride</h2>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-primary">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
            <span className="text-muted-foreground">elapsed</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Cycle</p>
            <p className="font-semibold text-foreground">{ride.cycleId}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Started</p>
            <p className="font-mono text-sm text-foreground">{formatTime(ride.startTime)}</p>
          </div>
        </div>

        {rideStatus && (
          <div className="space-y-3 p-3 bg-card rounded border border-border">
            <div>
              <p className="text-sm text-muted-foreground">Lock Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    rideStatus.lockState === "unlocked" ? "bg-green-500" : "bg-yellow-500"
                  }`}
                />
                <span className="font-medium text-foreground capitalize">{rideStatus.lockState}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Location</p>
              <p className="font-mono text-xs text-foreground mt-1">
                {rideStatus.currentLocation.lat.toFixed(4)},{rideStatus.currentLocation.lng.toFixed(4)}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          {onUnlockClick && rideStatus?.lockState === "locked" && (
            <Button
              onClick={onUnlockClick}
              disabled={isLoading}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Unlock Cycle
            </Button>
          )}
          <Button onClick={onEndRide} disabled={isLoading} variant="outline" className="flex-1 bg-transparent">
            {isLoading ? "Ending..." : "End Ride"}
          </Button>
        </div>
      </div>
    </Card>
  )
}
