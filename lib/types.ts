// TypeScript interfaces for PedalUp API contracts

export interface UserDto {
  id: number
  name: string
  email: string
  roles: string[]
}

export interface CycleDto {
  id: number
  cycleId: string
  available: boolean
  rating: number
  currentLocation: {
    lat: number
    lng: number
  }
  lastSeen?: number
  specs?: {
    model: string
    lockType: string
  }
}

export interface RideRequestDto {
  rideRequestId: number
  rideId?: number | null
  cycleId: string
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "ACTIVE" | "ENDED"
  requestedBy: number
  requestedAt: number
}

export interface RideDto {
  rideId: number
  cycleId: string
  userId: number
  startTime: number
  endTime?: number
  durationSeconds?: number
  distanceKm?: number
  amount?: number
  paymentStatus?: string
}

export interface RideStatusDto {
  rideId: number
  status: "ACTIVE" | "ENDED" | "PENDING"
  lockState: "locked" | "unlocked"
  currentLocation: {
    lat: number
    lng: number
  }
  startTime: number
}

export interface AuthResponse {
  timeStamp?: string
  data: {
    accessToken: string
  }
  error: null | string
}

export interface DeviceStatus {
  cycleId: string
  status: {
    lat: number
    lng: number
    lock: "locked" | "unlocked"
    battery: number
    timestamp: number
  }
}

export interface SocketCommand {
  cycleId: string
  command: "unlock" | "lock"
  meta?: {
    userId?: number
    rideId?: number
    reason?: string
  }
}
