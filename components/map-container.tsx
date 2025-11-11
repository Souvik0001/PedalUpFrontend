// Interactive map component displaying cycle locations
"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
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

  // ------- tween (added) -------
  const TWEEN_MS = 800
  const lastPosRef = useRef<Map<string | number, { lat: number; lng: number }>>(new Map())
  const targetPosRef = useRef<Map<string | number, { lat: number; lng: number }>>(new Map())
  const tweenStartRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)
  // this state is just to trigger redraws during animation;
  // we don't change any of your render UI based on it.
  const [animNow, setAnimNow] = useState<number>(0)

  const getKey = (c: CycleDto) => (c.id ?? (c as any).cycleId) as string | number

  // seed/advance tween whenever new cycle positions arrive
  useEffect(() => {
    // update targets from incoming cycles
    cycles.forEach((c) => {
      const key = getKey(c)
      const lat = (c as any)?.currentLocation?.lat
      const lng = (c as any)?.currentLocation?.lng
      if (typeof lat !== "number" || typeof lng !== "number") return
      targetPosRef.current.set(key, { lat, lng })
      // if first time seeing this key, start from the same point to avoid a jump
      if (!lastPosRef.current.has(key)) {
        lastPosRef.current.set(key, { lat, lng })
      }
    })

    // remove positions for cycles no longer present
    const currentKeys = new Set(cycles.map(getKey))
    for (const k of Array.from(lastPosRef.current.keys())) {
      if (!currentKeys.has(k)) {
        lastPosRef.current.delete(k)
        targetPosRef.current.delete(k)
      }
    }

    // start tween now
    tweenStartRef.current = performance.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      setAnimNow(now) // causes the draw effect to re-run
      const t = Math.min(1, (now - tweenStartRef.current) / TWEEN_MS)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // snap last = target at end of tween
        for (const [k, to] of targetPosRef.current.entries()) {
          lastPosRef.current.set(k, { ...to })
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycles])
  // ------- end tween -------

  // initial center (visual only; math now uses bounds)
  // const CAMPUS_CENTER_INIT = { lat: 22.5726, lng: 88.3639 }
  const CAMPUS_CENTER_INIT = { lat: 12.9692, lng: 79.1559 }
  const [center] = useState(CAMPUS_CENTER_INIT)

  const CANVAS_WIDTH = 800
  const CANVAS_HEIGHT = 600
  const PADDING = 60 // inner padding for the drawing area

  // --- Bounds from data (min/max lat/lng) ---
  const bounds = useMemo(() => {
    const lats = cycles
      .map((c) => (c as any)?.currentLocation?.lat)
      .filter((n): n is number => typeof n === "number" && !Number.isNaN(n))
    const lngs = cycles
      .map((c) => (c as any)?.currentLocation?.lng)
      .filter((n): n is number => typeof n === "number" && !Number.isNaN(n))

    if (lats.length === 0 || lngs.length === 0) {
      return {
        minLat: center.lat - 0.005,
        maxLat: center.lat + 0.005,
        minLng: center.lng - 0.005,
        maxLng: center.lng + 0.005,
      }
    }

    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    // tiny padding for margin and to avoid zero ranges
    const padLat = Math.max(1e-6, (maxLat - minLat) * 0.02)
    const padLng = Math.max(1e-6, (maxLng - minLng) * 0.02)

    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng,
    }
  }, [cycles, center.lat, center.lng])

  // --- Fit: start neutral so all points map into the inner rect ---
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat])

  // --- Project lng/lat into canvas space (normalized to bounds), then apply pan+zoom around canvas center ---
  const project = (lng: number, lat: number) => {
    const innerW = CANVAS_WIDTH - PADDING * 2
    const innerH = CANVAS_HEIGHT - PADDING * 2

    const lngRange = Math.max(1e-6, bounds.maxLng - bounds.minLng)
    const latRange = Math.max(1e-6, bounds.maxLat - bounds.minLat)

    // normalize into [0..1] within bounds (lng: L→R, lat: T→B)
    const nx = (lng - bounds.minLng) / lngRange
    const ny = (bounds.maxLat - lat) / latRange

    // map into inner rect
    let x = PADDING + nx * innerW
    let y = PADDING + ny * innerH

    // apply zoom around canvas center, then pan
    const cx = CANVAS_WIDTH / 2
    const cy = CANVAS_HEIGHT / 2
    x = (x - cx) * zoom + cx + pan.x
    y = (y - cy) * zoom + cy + pan.y

    return { x, y }
  }

  // helper to get blended (interpolated) position for a cycle (added)
  const blendedPos = (c: CycleDto): { lat: number; lng: number } | null => {
    const key = getKey(c)
    const from = lastPosRef.current.get(key)
    const to = targetPosRef.current.get(key)
    if (!from || !to) {
      const lat = (c as any)?.currentLocation?.lat
      const lng = (c as any)?.currentLocation?.lng
      return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null
    }
    const t = Math.min(1, (animNow - tweenStartRef.current) / TWEEN_MS)
    return {
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t,
    }
  }

  // --- Draw ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear
    ctx.fillStyle = "#f3f4f6"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // “Campus” frame (visual)
    ctx.strokeStyle = "#d1d5db"
    ctx.lineWidth = 2
    ctx.strokeRect(PADDING, PADDING, CANVAS_WIDTH - PADDING * 2, CANVAS_HEIGHT - PADDING * 2)

    // Label
    ctx.fillStyle = "#9ca3af"
    ctx.font = "12px sans-serif"
    ctx.fillText("Campus Area", CANVAS_WIDTH - 140, PADDING - 20)

    // Grid (visual)
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    for (let i = PADDING; i <= CANVAS_WIDTH - PADDING; i += 100) {
      ctx.beginPath()
      ctx.moveTo(i, PADDING)
      ctx.lineTo(i, CANVAS_HEIGHT - PADDING)
      ctx.stroke()
    }
    for (let i = PADDING; i <= CANVAS_HEIGHT - PADDING; i += 100) {
      ctx.beginPath()
      ctx.moveTo(PADDING, i)
      ctx.lineTo(CANVAS_WIDTH - PADDING, i)
      ctx.stroke()
    }

    // Draw cycles (using blended positions)
    cycles.forEach((cycle) => {
      const pos = blendedPos(cycle)
      if (!pos) return
      const { lat, lng } = pos

      const { x, y } = project(lng, lat)
      if (x < 0 || x > CANVAS_WIDTH || y < 0 || y > CANVAS_HEIGHT) return

      const isSelected = selectedCycle?.id === cycle.id
      const isAvailable = !!cycle.available

      ctx.beginPath()
      ctx.fillStyle = isSelected ? "#1e40af" : isAvailable ? "#10b981" : "#ef4444"
      ctx.arc(x, y, isSelected ? 12 : 8, 0, Math.PI * 2)
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = "#1e40af"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, 15, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.fillStyle = "#1f2937"
      ctx.font = "10px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(String(cycle.cycleId), x, y + 20)
    })

    // Reference dot at visual center
    ctx.fillStyle = "#6b7280"
    ctx.beginPath()
    ctx.arc(CANVAS_WIDTH / 2 + pan.x, CANVAS_HEIGHT / 2 + pan.y, 3, 0, Math.PI * 2)
    ctx.fill()
  // add animNow so we redraw every animation frame; everything else is your original deps
  }, [cycles, selectedCycle, pan, zoom, bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat, animNow])

  // --- Interaction handlers (same UX) ---
  const handleMouseDown = () => setIsDragging(true)

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const deltaX = e.movementX // smoother panning
    const deltaY = e.movementY
    setPan((p) => ({ x: p.x + deltaX, y: p.y + deltaY }))
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((z) => Math.max(0.1, Math.min(z * factor, 10)))
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const R = 20 // hit radius
    for (const cycle of cycles) {
      const pos = blendedPos(cycle)
      if (!pos) continue
      const { x: cx, y: cy } = project(pos.lng, pos.lat)
      const d = Math.hypot(x - cx, y - cy)
      if (d < R) {
        onCycleSelect(cycle)
        break
      }
    }
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
