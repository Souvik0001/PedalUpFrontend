"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useCycles } from "@/hooks/use-cycles"
import type { CycleDto } from "@/lib/types"
import { Button } from "@/components/ui/button"
import MapContainer from "@/components/map-container"
import CycleList from "@/components/cycle-list"
import DeviceSimulator from "@/components/device-simulator"
import { rideApi } from "@/lib/api-endpoints"

export default function DashboardPage() {
  const router = useRouter()
  const { user, logout, isAuthenticated, isInitialized } = useAuth()
  const { cycles, isLoading, fetchCycles, error: cyclesError } = useCycles()
  const [selectedCycle, setSelectedCycle] = useState<CycleDto | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [message, setMessage] = useState("")
  const [activeTab, setActiveTab] = useState<"map" | "list">("map")

  useEffect(() => {
    if (!isInitialized) return
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, isInitialized, router])

  const handleSelectCycle = (cycle: CycleDto) => {
    setSelectedCycle(cycle)
    setShowModal(true)
  }

  const handleRequestRide = async (cycle: CycleDto) => {
    if (!cycle.available) return

    setIsRequesting(true)
    try {
      const response = await rideApi.requestRide(cycle.cycleId, {
        pickupLat: cycle.currentLocation.lat,
        pickupLng: cycle.currentLocation.lng,
      })

      setMessage(`Ride request created! Request ID: ${response.data.rideRequestId}`)
      setShowModal(false)
      setSelectedCycle(null)

      // Redirect to ride page
      router.push("/ride")

      // Refresh cycles
      setTimeout(() => fetchCycles(), 1000)
    } catch (error: any) {
      const errorMsg =
        error.response?.status === 409 ? "Cycle is no longer available" : error.message || "Failed to request ride"
      setMessage(`Error: ${errorMsg}`)
    } finally {
      setIsRequesting(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">PedalUp</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user?.name}</p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="text-foreground border-border bg-transparent">
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {message && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg flex justify-between items-center">
            <span>{message}</span>
            <button onClick={() => setMessage("")} className="text-blue-800 hover:text-blue-900">
              ×
            </button>
          </div>
        )}

        {cyclesError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex justify-between items-center">
            <span>{cyclesError}</span>
            <button onClick={() => fetchCycles()} className="text-red-800 hover:text-red-900 font-semibold">
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Panel */}
          <div className="lg:col-span-2">
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab("map")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "map"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                Map View
              </button>
              <button
                onClick={() => setActiveTab("list")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "list"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                List View
              </button>
              <button
                onClick={() => fetchCycles()}
                disabled={isLoading}
                className="ml-auto px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {/* Content Area */}
            <div className="bg-card border border-border rounded-lg p-6">
              {activeTab === "map" && (
                <MapContainer cycles={cycles} onCycleSelect={handleSelectCycle} selectedCycle={selectedCycle} />
              )}
              {activeTab === "list" && (
                <CycleList
                  cycles={cycles}
                  onSelectCycle={handleSelectCycle}
                  selectedCycleId={selectedCycle?.id}
                  isLoading={isRequesting}
                />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-lg p-6 sticky top-20">
              <h2 className="text-lg font-bold text-foreground mb-4">Statistics</h2>
              <div className="space-y-4">
                <div className="p-3 bg-secondary rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Cycles</p>
                  <p className="text-2xl font-bold text-foreground">{cycles.length}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold text-green-600">{cycles.filter((c) => c.available).length}</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">In Use</p>
                  <p className="text-2xl font-bold text-red-600">{cycles.filter((c) => !c.available).length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Device Simulator */}
      <DeviceSimulator />
    </div>
  )
}
