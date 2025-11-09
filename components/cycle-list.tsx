// List view of available cycles
"use client"
import type { CycleDto } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface CycleListProps {
  cycles: CycleDto[]
  onSelectCycle: (cycle: CycleDto) => void
  selectedCycleId?: number
  isLoading?: boolean
}

export default function CycleList({ cycles, onSelectCycle, selectedCycleId, isLoading }: CycleListProps) {
  const availableCycles = cycles.filter((c) => c.available)
  const unavailableCycles = cycles.filter((c) => !c.available)

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
                      onSelectCycle(cycle)
                    }}
                    size="sm"
                    disabled={isLoading}
                    className="bg-primary text-primary-foreground"
                  >
                    Select
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
            {unavailableCycles.map((cycle) => (
              <Card key={cycle.id} className="p-3 bg-muted/50 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-muted-foreground">{cycle.cycleId}</p>
                    <p className="text-sm text-muted-foreground">Rating: ⭐ {cycle.rating.toFixed(1)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Unavailable</span>
                </div>
              </Card>
            ))}
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
