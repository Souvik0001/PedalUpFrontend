// API endpoint functions with proper typing
import apiClient from "./api-client"
import type { AuthResponse, UserDto, CycleDto, RideRequestDto, RideDto, RideStatusDto } from "./types"

// Auth endpoints
export const authApi = {
  signup: (data: { name: string; email: string; password: string }) => apiClient.post<UserDto>("/auth/signup", data),

  login: (data: { email: string; password: string }) => apiClient.post<AuthResponse>("/auth/login", data),

  refresh: () => apiClient.post<AuthResponse>("/auth/refresh", {}, { withCredentials: true }),

  logout: () => apiClient.post("/auth/logout"),
}

// Cycle endpoints
export const cycleApi = {
  getAll: () => apiClient.get<CycleDto[]>("/cycles"),

  getById: (id: number) => apiClient.get<CycleDto>(`/cycles/${id}`),
}

// Ride endpoints
export const rideApi = {
  requestRide: (cycleId: string, data?: { pickupLat?: number; pickupLng?: number; notes?: string }) =>
    apiClient.post<RideRequestDto>(`/riders/requestRide/${cycleId}`, data || {}),

  acceptRide: (rideRequestId: number) => apiClient.post<RideDto>(`/riders/acceptRide/${rideRequestId}`, {}),

  endRide: (rideId: number, data?: { endLat?: number; endLng?: number }) =>
    apiClient.post<RideDto>(`/riders/endRide/${rideId}`, data || {}),

  getRideStatus: (rideId: number) => apiClient.get<RideStatusDto>(`/riders/rideStatus/${rideId}`),

  updateCycleLocation: (cycleId: string, data: { latitude: number; longitude: number; timestamp: number }) =>
    apiClient.post(`/riders/cycleLocation/${cycleId}`, data),
}
