import apiClient from "@/lib/api-client"

function unwrap<T = any>(res: any): T {
  if (res && typeof res === "object" && "data" in res) {
    const inner = (res as any).data
    return inner && typeof inner === "object" && "data" in inner ? inner.data : inner
  }
  return res as T
}

/** Local storage helpers to remember the user's active ride */
export type ActiveRide = { rideId: number; cycleId: number } | null

export function getActiveRide(): ActiveRide {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("activeRide")
    return raw ? (JSON.parse(raw) as ActiveRide) : null
  } catch {
    return null
  }
}

export function setActiveRide(v: ActiveRide) {
  if (typeof window === "undefined") return
  if (!v) localStorage.removeItem("activeRide")
  else localStorage.setItem("activeRide", JSON.stringify(v))
}

/* ---------------- LED bridge (optional; no-op if disabled) ---------------- */

const LED_ENABLED =
  String(process.env.NEXT_PUBLIC_LED_BRIDGE_ENABLED ?? "true").toLowerCase() === "true"

const LED_BASE = process.env.NEXT_PUBLIC_LED_BRIDGE_URL || "http://localhost:5055"

function pingBridge(path: "/led/on" | "/led/off") {
  if (typeof window === "undefined" || !LED_ENABLED) return
  try {
    // Fire-and-forget; avoid CORS preflights
    // eslint-disable-next-line no-void
    void fetch(`${LED_BASE}${path}`, { method: "GET", mode: "no-cors" })
  } catch {
    // optional feature: ignore errors
  }
}

/* ---------------- Booking APIs (unchanged logic + LED pings) --------------- */

/**
 * Booking in your backend is a single call:
 * POST /riders/requestRide/{cycleId}
 * - Creates a Ride immediately (no separate accept step)
 * - Marks the cycle unavailable
 */
export async function bookCycle(cycleId: string | number) {
  const reqRes = await apiClient.post(`/riders/requestRide/${cycleId}`, {
    pickupLat: 22.5726,
    pickupLng: 88.3639,
    notes: "UI booking",
  })

  const payload = unwrap(reqRes)
  console.debug("[bookCycle] requestRide payload:", payload)

  // Your backend returns a Ride (RideDto); grab the ride id
  const rideId = payload?.rideId ?? payload?.id
  if (!rideId) throw new Error("Request ride succeeded but response has no rideId")

  // 🔔 LED ON (optional, non-blocking)
  pingBridge("/led/on")

  // Some responses may also include a request id; pass through if present
  const rideRequestId = payload?.rideRequestId ?? payload?.requestId ?? null
  return { rideRequestId, rideId: Number(rideId) }
}

/**
 * Ending a ride:
 * POST /riders/endRide/{rideId}
 */
export async function endRide(rideId: number, lat = 22.5731, lng = 88.3642) {
  const res = await apiClient.post(`/riders/endRide/${rideId}`, { endLat: lat, endLng: lng })
  const data = unwrap(res)
  console.debug("[endRide] payload:", data)

  // 🔔 LED OFF (optional, non-blocking)
  pingBridge("/led/off")

  return data ?? null
}
