"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { initializeSocket, getSocket, onCommandResponse } from "@/lib/socket-client"
import { useAuth } from "@/contexts/auth-context"
import { rideApi, cycleApi } from "@/lib/api-endpoints"

type LockState = "locked" | "unlocked"

interface DeviceState {
  cycleCode: string
  lat: number
  lng: number
  lock: LockState
  battery: number
  isConnected: boolean
}

const TICK_MS =
  Number(process.env.NEXT_PUBLIC_DEVICE_TICK_MS ?? "") > 0
    ? Number(process.env.NEXT_PUBLIC_DEVICE_TICK_MS)
    : 2000

const STEP_DEG =
  Number(process.env.NEXT_PUBLIC_DEVICE_STEP_DEG ?? "") > 0
    ? Number(process.env.NEXT_PUBLIC_DEVICE_STEP_DEG)
    : 0.0005 // ~55m per tick

function jitter(lat: number, lng: number) {
  const dLat = (Math.random() - 0.5) * STEP_DEG
  const dLng = (Math.random() - 0.5) * STEP_DEG
  return { lat: lat + dLat, lng: lng + dLng }
}

function getActiveRide(): { rideId: number | null; cycleId: string | null } {
  try {
    const raw = localStorage.getItem("activeRide")
    if (!raw) return { rideId: null, cycleId: null }
    const parsed = JSON.parse(raw)
    return {
      rideId: parsed?.rideId ?? null,
      cycleId: parsed?.cycleId ? String(parsed.cycleId) : null,
    }
  } catch {
    return { rideId: null, cycleId: null }
  }
}

function friendlyError(err: any): string {
  const status = err?.response?.status
  const data = err?.response?.data
  let msg = err?.message || "Unknown error"
  if (data) {
    try {
      msg = typeof data === "string" ? data : JSON.stringify(data)
    } catch {
      msg = String(data)
    }
  }
  return status ? `${status} ${msg}` : msg
}

/** Fetch the current location of a cycle from backend and return {lat,lng}. */
async function fetchCycleLocationFromServer(cycleCode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await cycleApi.getAll()
    const payload = (res as any)?.data?.data ?? (res as any)?.data ?? res
    const list: any[] = Array.isArray(payload?.cycles) ? payload.cycles : payload
    const found = list?.find((c) => String(c?.cycleId) === String(cycleCode))
    if (!found) return null

    // Normalize GeoJSON -> {lat,lng}
    const loc = found?.currentLocation
    if (loc?.coordinates && Array.isArray(loc.coordinates)) {
      const [lng, lat] = loc.coordinates
      if (typeof lat === "number" && typeof lng === "number") return { lat, lng }
    }
    // Already in {lat,lng}
    if (typeof loc?.lat === "number" && typeof loc?.lng === "number") {
      return { lat: loc.lat, lng: loc.lng }
    }
  } catch {
    // ignore, will fall back
  }
  return null
}

export default function DeviceSimulator() {
  const { accessToken } = useAuth()
  const [device, setDevice] = useState<DeviceState>({
    cycleCode: "1003", // will be overridden by active ride on start if present
    // NOTE: these values are only a placeholder; we now prime from server on start
    lat: 12.971639,
    lng: 77.594409,
    lock: "locked",
    battery: 87,
    isConnected: false,
  })
  const [commandLog, setCommandLog] = useState<string[]>([])
  const [autoUpdate, setAutoUpdate] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rideIdRef = useRef<number | null>(null)
  const cycleCodeRef = useRef<string>("")

  // Socket wiring (UI unchanged)
  useEffect(() => {
    if (!accessToken) return
    initializeSocket(accessToken)
    const s = getSocket()

    s?.on("connect", () => {
      setCommandLog((logs) => [...logs, "[SOCKET] connected"])
      s?.emit("register", {
        role: "device",
        cycleId: device.cycleCode,
        meta: { battery: device.battery, lock: device.lock },
      })
      setDevice((d) => ({ ...d, isConnected: true }))
    })

    s?.on("disconnect", () => {
      setCommandLog((logs) => [...logs, "[SOCKET] disconnected"])
      setDevice((d) => ({ ...d, isConnected: false }))
    })

    const unsubscribe = onCommandResponse((data) => {
      setCommandLog((logs) => [...logs, `[COMMAND] ${JSON.stringify(data)}`])
      if (data.command === "unlock") setDevice((d) => ({ ...d, lock: "unlocked" }))
      if (data.command === "lock") setDevice((d) => ({ ...d, lock: "locked" }))
    })

    return () => {
      unsubscribe?.()
      s?.off("connect")
      s?.off("disconnect")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  async function pushLocation(lat: number, lng: number) {
    const cycleCode = cycleCodeRef.current || device.cycleCode
    try {
      await rideApi.updateCycleLocation(
        cycleCode,              // path uses *string* cycle code (e.g., "1003")
        lat,
        lng,
        rideIdRef.current ?? undefined
      )
      setCommandLog((logs) => [
        ...logs,
        `[HTTP] push (${cycleCode}) → ${lat.toFixed(5)}, ${lng.toFixed(5)}`
      ])
    } catch (err: any) {
      setCommandLog((logs) => [...logs, `[HTTP] push failed: ${friendlyError(err)}`])
    }
  }

  // Auto update loop with **priming from DB** to avoid teleport/overlap
  useEffect(() => {
    if (!autoUpdate) {
      if (timerRef.current != null) window.clearInterval(timerRef.current)
      timerRef.current = null
      return
    }

    (async () => {
      // 1) Prefer active ride
      const { rideId, cycleId } = getActiveRide()
      rideIdRef.current = rideId
      cycleCodeRef.current = cycleId || device.cycleCode
      if (cycleId) setDevice((d) => ({ ...d, cycleCode: cycleId }))
      setCommandLog((logs) => [
        ...logs,
        `[INFO] activeRide rideId=${rideId ?? "null"} cycleId=${cycleId ?? device.cycleCode}`
      ])

      // 2) PRIME FROM SERVER — read current DB location of this cycle
      const prime = await fetchCycleLocationFromServer(cycleCodeRef.current)
      if (prime) {
        setDevice((d) => ({ ...d, lat: prime.lat, lng: prime.lng }))
        setCommandLog((logs) => [
          ...logs,
          `[INFO] primed from DB → ${prime.lat.toFixed(5)}, ${prime.lng.toFixed(5)}`
        ])
      } else {
        setCommandLog((logs) => [
          ...logs,
          `[WARN] could not prime from DB; starting from local state`
        ])
      }

      // 3) First push immediately (from primed location)
      await pushLocation(prime?.lat ?? device.lat, prime?.lng ?? device.lng)

      // 4) Start periodic updates (small random walk)
      timerRef.current = window.setInterval(async () => {
        const next = jitter(
          prime?.lat ?? device.lat,
          prime?.lng ?? device.lng
        )
        // update baseline so we keep walking
        prime ? ((prime.lat = next.lat), (prime.lng = next.lng)) : setDevice((d) => ({ ...d, lat: next.lat, lng: next.lng }))

        await pushLocation(next.lat, next.lng)

        // also mirror to relay (unchanged)
        const s = getSocket()
        s?.emit("status", {
          cycleId: cycleCodeRef.current,
          status: {
            lat: next.lat,
            lng: next.lng,
            lock: device.lock,
            battery: device.battery,
            timestamp: Date.now(),
          },
        })
      }, TICK_MS)
    })()

    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUpdate])

  return (
    <div className="mt-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="text-sm font-medium">Device Simulator</div>
            <div className="text-xs text-muted-foreground">
              Cycle: <span className="font-mono">{device.cycleCode}</span>
            </div>
            {device.isConnected ? (
              <div className="text-xs text-green-600">connected</div>
            ) : (
              <div className="text-xs text-yellow-600">connecting…</div>
            )}
          </div>

          <div className="flex gap-2">
            {!autoUpdate ? (
              <Button size="sm" onClick={() => setAutoUpdate(true)}>
                Start Auto Update
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setAutoUpdate(false)}>
                Stop Auto Update
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="flex items-center gap-2">
            <input
              className="border rounded px-2 py-1 text-sm font-mono w-40"
              value={device.cycleCode}
              onChange={(e) => {
                cycleCodeRef.current = e.target.value
                setDevice((d) => ({ ...d, cycleCode: e.target.value }))
              }}
              placeholder="1003"
            />
            <Button
              size="sm"
              onClick={() => {
                const s = getSocket()
                s?.emit("register", {
                  role: "device",
                  cycleId: device.cycleCode,
                  meta: { battery: device.battery, lock: device.lock },
                })
                setCommandLog((logs) => [...logs, "[SOCKET] re-registered"])
              }}
            >
              Re-register
            </Button>
          </div>

          {device.isConnected && (
            <div className="bg-muted p-2 rounded text-xs text-muted-foreground mb-2 space-y-1 font-mono">
              <div>Lat: {device.lat.toFixed(6)}</div>
              <div>Lng: {device.lng.toFixed(6)}</div>
              <div>Lock: {device.lock}</div>
              <div>Battery: {device.battery}%</div>
            </div>
          )}

          <div className="bg-muted rounded p-2 max-h-40 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              Log ({commandLog.length})
            </p>
            <div className="space-y-1">
              {commandLog.slice(-12).map((log, idx) => (
                <div key={idx} className="text-xs text-muted-foreground font-mono truncate">
                  {log}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: Start by booking a cycle (so it&apos;s in-use), then click <span className="font-semibold">Start Auto Update</span>.
            The simulator now primes from the DB to avoid teleporting and overlapping with other cycles.
          </p>
        </div>
      </Card>
    </div>
  )
}
