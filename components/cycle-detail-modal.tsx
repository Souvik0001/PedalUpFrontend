// Modal showing cycle details
"use client"
import type { CycleDto } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface CycleDetailModalProps {
  cycle: CycleDto | null
  onClose: () => void
  onRequestRide: (cycle: CycleDto) => void
  isLoading?: boolean
}

export default function CycleDetailModal({ cycle, onClose, onRequestRide, isLoading }: CycleDetailModalProps) {
  if (!cycle) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md shadow-xl">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-foreground">{cycle.cycleId}</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${cycle.available ? "bg-green-500" : "bg-red-500"}`}
                />
                <span className="font-medium text-foreground">{cycle.available ? "Available" : "In Use"}</span>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Rating</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-lg">⭐</span>
                <span className="font-medium text-foreground">{cycle.rating.toFixed(1)}</span>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="font-mono text-sm text-foreground mt-1">
                {cycle.currentLocation.lat.toFixed(4)},{cycle.currentLocation.lng.toFixed(4)}
              </p>
            </div>

            {cycle.specs && (
              <div>
                <p className="text-sm text-muted-foreground">Specifications</p>
                <p className="text-sm text-foreground mt-1">Model: {cycle.specs.model}</p>
                <p className="text-sm text-foreground">Lock: {cycle.specs.lockType}</p>
              </div>
            )}

            <div className="pt-4 border-t border-border flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
                Close
              </Button>
              <Button
                onClick={() => onRequestRide(cycle)}
                disabled={!cycle.available || isLoading}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? "Requesting..." : "Request Ride"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
