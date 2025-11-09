// Interactive map component displaying cycle locations
"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import type { CycleDto } from "@/lib/types"

interface MapContainerProps {
  cycles: CycleDto[]
  onCycleSelect: (cycle: CycleDto) => void
  selectedCycle: CycleDto | null
}

export default function MapContainer({ cycles, onCycleSelect, selectedCycle }: MapContainerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  // Campus area coordinates (example: campus center)
  const CAMPUS_CENTER = { lat: 12.9716, lng: 77.5946 }
  const CANVAS_WIDTH = 800
  const CANVAS_HEIGHT = 600

  const lngToX = (lng: number) => {
    return ((lng - CAMPUS_CENTER.lng + 0.01) * 1000 + pan.x) * zoom
  }

  const latToY = (lat: number) => {
    return ((CAMPUS_CENTER.lat - lat + 0.01) * 1000 + pan.y) * zoom
  }

  const xToLng = (x: number) => {
    return x / (1000 * zoom) - 0.01 + CAMPUS_CENTER.lng
  }

  const yToLat = (y: number) => {
    return CAMPUS_CENTER.lat - (y / (1000 * zoom) - 0.01)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "#f3f4f6"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw campus boundaries
    ctx.strokeStyle = "#d1d5db"
    ctx.lineWidth = 2
    ctx.strokeRect(50, 50, CANVAS_WIDTH - 100, CANVAS_HEIGHT - 100)

    // Draw campus label
    ctx.fillStyle = "#9ca3af"
    ctx.font = "12px sans-serif"
    ctx.fillText("Campus Area", CANVAS_WIDTH - 120, 30)

    // Draw grid
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    for (let i = 0; i < CANVAS_WIDTH; i += 100) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let i = 0; i < CANVAS_HEIGHT; i += 100) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(CANVAS_WIDTH, i)
      ctx.stroke()
    }

    // Draw cycles
    cycles.forEach((cycle) => {
      const x = lngToX(cycle.currentLocation.lng)
      const y = latToY(cycle.currentLocation.lat)

      // Check if within canvas bounds
      if (x > 0 && x < CANVAS_WIDTH && y > 0 && y < CANVAS_HEIGHT) {
        const isSelected = selectedCycle?.id === cycle.id
        const isAvailable = cycle.available

        // Draw cycle marker
        ctx.fillStyle = isSelected ? "#1e40af" : isAvailable ? "#10b981" : "#ef4444"
        ctx.beginPath()
        ctx.arc(x, y, isSelected ? 12 : 8, 0, 2 * Math.PI)
        ctx.fill()

        // Draw outer ring if selected
        if (isSelected) {
          ctx.strokeStyle = "#1e40af"
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(x, y, 15, 0, 2 * Math.PI)
          ctx.stroke()
        }

        // Draw label
        ctx.fillStyle = "#1f2937"
        ctx.font = "10px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText(cycle.cycleId, x, y + 20)
      }
    })

    // Draw center point
    ctx.fillStyle = "#6b7280"
    ctx.beginPath()
    ctx.arc(lngToX(CAMPUS_CENTER.lng), latToY(CAMPUS_CENTER.lat), 4, 0, 2 * Math.PI)
    ctx.fill()
  }, [cycles, selectedCycle, pan, zoom])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const deltaX = e.clientX - rect.left - CANVAS_WIDTH / 2
    const deltaY = e.clientY - rect.top - CANVAS_HEIGHT / 2

    setPan((p) => ({
      x: p.x + deltaX * 0.1,
      y: p.y + deltaY * 0.1,
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((z) => Math.max(0.5, Math.min(z * zoomFactor, 3)))
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if clicked on any cycle
    cycles.forEach((cycle) => {
      const cycleX = lngToX(cycle.currentLocation.lng)
      const cycleY = latToY(cycle.currentLocation.lat)
      const distance = Math.sqrt((x - cycleX) ** 2 + (y - cycleY) ** 2)

      if (distance < 20) {
        onCycleSelect(cycle)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        className="border border-border rounded-lg cursor-grab active:cursor-grabbing bg-white"
      />
      <div className="text-xs text-muted-foreground flex justify-between">
        <span>Drag to pan • Scroll to zoom</span>
        <span>Zoom: {zoom.toFixed(1)}x</span>
      </div>
    </div>
  )
}
