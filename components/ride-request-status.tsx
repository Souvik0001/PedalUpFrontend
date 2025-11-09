// Component showing ride request status
"use client"

import { useState, useEffect } from "react"
import type { RideRequestDto } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface RideRequestStatusProps {
  rideRequest: RideRequestDto
  onAccept?: () => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

export default function RideRequestStatus({ rideRequest, onAccept, onCancel, isLoading }: RideRequestStatusProps) {
  const [waitTime, setWaitTime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rideRequest.requestedAt) / 1000)
      setWaitTime(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [rideRequest.requestedAt])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30"
      case "ACCEPTED":
        return "text-green-600 bg-green-50 dark:bg-green-900/30"
      case "ACTIVE":
        return "text-blue-600 bg-blue-50 dark:bg-blue-900/30"
      case "ENDED":
        return "text-gray-600 bg-gray-50 dark:bg-gray-900/30"
      default:
        return "text-gray-600"
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-2">Ride Request</h2>
          <div
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(rideRequest.status)}`}
          >
            {rideRequest.status}
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Cycle ID</p>
            <p className="font-semibold text-foreground">{rideRequest.cycleId}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Request ID</p>
            <p className="font-mono text-sm text-foreground">#{rideRequest.rideRequestId}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Waiting for</p>
            <p className="font-mono text-sm text-foreground">
              {Math.floor(waitTime / 60)}m {waitTime % 60}s
            </p>
          </div>
        </div>

        {rideRequest.status === "PENDING" && (
          <div className="flex gap-3 pt-4">
            <Button onClick={onAccept} disabled={isLoading} className="flex-1 bg-primary text-primary-foreground">
              {isLoading ? "Accepting..." : "Accept"}
            </Button>
            <Button onClick={onCancel} disabled={isLoading} variant="outline" className="flex-1 bg-transparent">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
