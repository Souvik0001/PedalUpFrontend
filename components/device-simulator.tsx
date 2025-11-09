// Developer panel for simulating Arduino device via Socket.IO
"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { initializeSocket, getSocket, onCommandResponse } from "@/lib/socket-client"
import { useAuth } from "@/contexts/auth-context"

interface DeviceState {
  cycleId: string
  lat: number
  lng: number
  lock: "locked" | "unlocked"
  battery: number
  isConnected: boolean
}

export default function DeviceSimulator() {
  const { accessToken } = useAuth()
  const [device, setDevice] = useState<DeviceState>({
    cycleId: "CYC-1001",
    lat: 12.9716,
    lng: 77.5946,
    lock: "locked",
    battery: 87,
    isConnected: false,
  })
  const [autoUpdate, setAutoUpdate] = useState(false)
  const [commandLog, setCommandLog] = useState<string[]>([])
  const [isVisible, setIsVisible] = useState(false)

  // Check environment to show only in dev
  const isDev = process.env.NODE_ENV !== "production"

  useEffect(() => {
    if (!isDev) return

    return () => {
      // Cleanup on unmount
    }
  }, [isDev])

  const handleConnect = async () => {
    if (!accessToken) {
      setCommandLog((logs) => [...logs, "[ERROR] No access token"])
      return
    }

    try {
      const socket = initializeSocket(accessToken)
      if (socket) {
        // Register as device
        socket.emit("register", {
          role: "device",
          cycleId: device.cycleId,
          auth: accessToken,
        })

        // Listen for commands
        const unsubscribe = onCommandResponse((data) => {
          setCommandLog((logs) => [...logs, `[COMMAND] ${JSON.stringify(data)}`])

          if (data.command === "unlock") {
            setDevice((d) => ({ ...d, lock: "unlocked" }))
          } else if (data.command === "lock") {
            setDevice((d) => ({ ...d, lock: "locked" }))
          }
        })

        setDevice((d) => ({ ...d, isConnected: true }))
        setCommandLog((logs) => [...logs, "[CONNECTED] Device connected to relay"])

        return () => unsubscribe()
      }
    } catch (error: any) {
      setCommandLog((logs) => [...logs, `[ERROR] ${error.message}`])
    }
  }

  const handleSendStatus = () => {
    const socket = getSocket()
    if (!socket) {
      setCommandLog((logs) => [...logs, "[ERROR] Socket not connected"])
      return
    }

    const status = {
      cycleId: device.cycleId,
      status: {
        lat: device.lat,
        lng: device.lng,
        lock: device.lock,
        battery: device.battery,
        timestamp: Date.now(),
      },
    }

    socket.emit("status", status)
    setCommandLog((logs) => [
      ...logs,
      `[STATUS] Sent: ${device.cycleId} @ ${device.lat.toFixed(4)}, ${device.lng.toFixed(4)}`,
    ])
  }

  const handleToggleLock = () => {
    setDevice((d) => ({
      ...d,
      lock: d.lock === "locked" ? "unlocked" : "locked",
    }))

    const socket = getSocket()
    if (socket) {
      socket.emit("status", {
        cycleId: device.cycleId,
        status: {
          lat: device.lat,
          lng: device.lng,
          lock: device.lock === "locked" ? "unlocked" : "locked",
          battery: device.battery,
          timestamp: Date.now(),
        },
      })
    }
  }

  const handleUpdateLocation = () => {
    setDevice((d) => ({
      ...d,
      lat: d.lat + (Math.random() - 0.5) * 0.0005,
      lng: d.lng + (Math.random() - 0.5) * 0.0005,
    }))
  }

  // Auto-update location
  useEffect(() => {
    if (!autoUpdate || !device.isConnected) return

    const interval = setInterval(() => {
      handleUpdateLocation()
      handleSendStatus()
    }, 5000)

    return () => clearInterval(interval)
  }, [autoUpdate, device.isConnected, device.cycleId, device.lat, device.lng, device.lock, device.battery])

  if (!isDev) return null

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90 z-40 shadow-lg"
      >
        Dev: Device Simulator
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 z-50">
      <Card className="bg-card shadow-xl border-2 border-primary">
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-foreground">Device Simulator</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-muted-foreground hover:text-foreground text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Status */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Connection:</span>
              <span className={`font-semibold ${device.isConnected ? "text-green-600" : "text-red-600"}`}>
                {device.isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded font-mono">Cycle: {device.cycleId}</div>
          </div>

          {/* Controls */}
          <div className="space-y-2 mb-4">
            <Button
              onClick={handleConnect}
              disabled={device.isConnected}
              className="w-full bg-primary text-primary-foreground"
              size="sm"
            >
              {device.isConnected ? "Connected" : "Connect to Relay"}
            </Button>

            {device.isConnected && (
              <>
                <Button onClick={handleSendStatus} variant="outline" size="sm" className="w-full bg-transparent">
                  Send Status
                </Button>

                <Button
                  onClick={handleToggleLock}
                  size="sm"
                  className={`w-full ${
                    device.lock === "locked" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"
                  } text-white`}
                >
                  {device.lock === "locked" ? "Unlock" : "Lock"}
                </Button>

                <Button onClick={handleUpdateLocation} variant="outline" size="sm" className="w-full bg-transparent">
                  Update Location
                </Button>

                <label className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                  <input
                    type="checkbox"
                    checked={autoUpdate}
                    onChange={(e) => setAutoUpdate(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <span className="text-foreground">Auto-update (5s)</span>
                </label>
              </>
            )}
          </div>

          {/* Device Info */}
          {device.isConnected && (
            <div className="bg-muted p-2 rounded text-xs text-muted-foreground mb-4 space-y-1 font-mono">
              <div>Lat: {device.lat.toFixed(6)}</div>
              <div>Lng: {device.lng.toFixed(6)}</div>
              <div>Lock: {device.lock}</div>
              <div>Battery: {device.battery}%</div>
            </div>
          )}

          {/* Command Log */}
          <div className="bg-muted rounded p-2 max-h-40 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Log ({commandLog.length})</p>
            <div className="space-y-1">
              {commandLog.slice(-5).map((log, idx) => (
                <div key={idx} className="text-xs text-muted-foreground font-mono truncate">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
