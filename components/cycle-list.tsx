// List view of available cycles
"use client"

import type { CycleDto } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { bookCycle, endRide } from "@/lib/booking"
import { useEffect, useMemo, useState } from "react"

type ActiveRide = { rideId: number; cycleId: number } | null

function getActiveRide(): ActiveRide {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("activeRide")
    return raw ? (JSON.parse(raw) as ActiveRide) : null
  } catch {
    return null
  }
}

function setActiveRide(v: ActiveRide) {
  if (typeof window === "undefined") return
  if (!v) localStorage.removeItem("activeRide")
  else localStorage.setItem("activeRide", JSON.stringify(v))
}

interface CycleListProps {
  cycles: CycleDto[]
  onSelectCycle: (cycle: CycleDto) => void
  selectedCycleId?: number
  isLoading?: boolean
}

export default function CycleList({ cycles, onSelectCycle, selectedCycleId, isLoading }: CycleListProps) {
  const [busyId, setBusyId] = useState<number | null>(null)
  const [activeRide, setActiveRideState] = useState<ActiveRide>(getActiveRide())

  // keep local state in sync with localStorage (refreshes, other tabs, etc.)
  useEffect(() => {
    const i = setInterval(() => setActiveRideState(getActiveRide()), 1000)
    return () => clearInterval(i)
  }, [])

  const availableCycles = useMemo(() => cycles.filter((c) => c.available), [cycles])
  const unavailableCycles = useMemo(() => cycles.filter((c) => !c.available), [cycles])

  const isUsersActiveCycle = (cycle: CycleDto) => {
    if (!activeRide) return false
    const cid = Number(cycle.cycleId ?? cycle.id)
    return Number(activeRide.cycleId) === cid
  }

  const hardRefresh = () => {
    // minimal, zero-UX-change way to make counters and lists correct
    if (typeof window !== "undefined") window.location.reload()
  }

  const handleBook = async (cycle: CycleDto) => {
    try {
      setBusyId(cycle.id)
      const cid = Number(cycle.cycleId ?? cycle.id) // backend expects public cycle number
      const { rideId } = await bookCycle(cid)
      setActiveRide({ rideId, cycleId: cid })
      setActiveRideState({ rideId, cycleId: cid })
      onSelectCycle(cycle)
      // Make the UI reflect the new unavailable state and stats
      hardRefresh()
    } catch (e) {
      console.error("Booking failed:", e)
      alert("Booking failed. See console for details.")
    } finally {
      setBusyId(null)
    }
  }

  const handleEnd = async (cycle: CycleDto) => {
    if (!activeRide) return
    try {
      setBusyId(cycle.id)
      await endRide(activeRide.rideId)
      setActiveRide(null)
      setActiveRideState(null)
      // Make the cycle reappear under Available and update stats
      hardRefresh()
    } catch (e) {
      console.error("End ride failed:", e)
      alert("End ride failed. See console for details.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {availableCycles.length > 0 && (
        <div>
          <h3 className="font-semibold text-foreground mb-3">Available</h3>
          <div className="space-y-2">
            {availableCycles.map((cycle) => (
              <Card
                key={cycle.id}
                className={`p-3 cursor-pointer transition-colors ${
                  selectedCycleId === cycle.id ? "bg-primary/10 border-primary" : "hover:bg-secondary"
                }`}
                onClick={() => onSelectCycle(cycle)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{cycle.cycleId}</p>
                    <p className="text-sm text-muted-foreground">Rating: ⭐ {cycle.rating.toFixed(1)}</p>
                  </div>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBook(cycle)
                    }}
                    size="sm"
                    disabled={isLoading || busyId === cycle.id}
                    className="bg-primary text-primary-foreground"
                  >
                    {busyId === cycle.id ? "..." : "Select"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {unavailableCycles.length > 0 && (
        <div>
          <h3 className="font-semibold text-muted-foreground mb-3">In Use ({unavailableCycles.length})</h3>
          <div className="space-y-2">
            {unavailableCycles.map((cycle) => {
              const isMine = isUsersActiveCycle(cycle)
              return (
                <Card
                  key={cycle.id}
                  className={`p-3 ${isMine ? "bg-yellow-50 border-yellow-300" : "bg-muted/50 opacity-90"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className={`font-semibold ${isMine ? "text-foreground" : "text-muted-foreground"}`}>
                        {cycle.cycleId}
                      </p>
                      <p className="text-sm text-muted-foreground">Rating: ⭐ {cycle.rating.toFixed(1)}</p>
                    </div>

                    {isMine ? (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEnd(cycle)
                        }}
                        size="sm"
                        disabled={isLoading || busyId === cycle.id}
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        {busyId === cycle.id ? "Ending..." : "End Ride"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unavailable</span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {cycles.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No cycles available</p>
        </Card>
      )}
    </div>
  )
}
