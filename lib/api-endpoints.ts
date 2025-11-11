// API endpoint functions with proper typing
import apiClient from "./api-client"
import type {
  AuthResponse,
  UserDto,
  CycleDto,
  RideRequestDto,
  RideDto,
  RideStatusDto,
} from "./types"

// ---------------- Auth ----------------
export const authApi = {
  signup: (data: { name: string; email: string; password: string }) =>
    apiClient.post<UserDto>("/auth/signup", data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthResponse>("/auth/login", data),

  refresh: () => apiClient.post<AuthResponse>("/auth/refresh", {}, { withCredentials: true }),

  logout: () => apiClient.post("/auth/logout"),
}

// ---------------- Cycles ----------------
export const cycleApi = {
  getAll: () => apiClient.get<CycleDto[]>("/cycles"),
  getById: (id: number | string) => apiClient.get<CycleDto>(`/cycles/${id}`),
}

// ---------------- Rides ----------------
export const rideApi = {
  requestRide: (
    cycleId: string,
    data?: { pickupLat?: number; pickupLng?: number; notes?: string }
  ) => apiClient.post<RideRequestDto>(`/riders/requestRide/${cycleId}`, data || {}),

  acceptRide: (rideRequestId: number) =>
    apiClient.post<RideDto>(`/riders/acceptRide/${rideRequestId}`, {}),

  endRide: (rideId: number, data?: { endLat?: number; endLng?: number }) =>
    apiClient.post<RideDto>(`/riders/endRide/${rideId}`, data || {}),

  getRideStatus: (rideId: number) =>
    apiClient.get<RideStatusDto>(`/riders/rideStatus/${rideId}`),

  /**
   * Live location update.
   * Backend expects the *cycle code* in the path (string), not numeric DB id.
   * Body uses GeoJSON order [lng, lat]. rideId is included for in-ride validation.
   * POST /riders/cycleLocation/{cycleCode}
   */
  updateCycleLocation: (
    cycleCode: string,     // <-- force string path
    lat: number,
    lng: number,
    rideId?: number
  ) =>
    apiClient.post(`/riders/cycleLocation/${encodeURIComponent(cycleCode)}`, {
      rideId,
      cycleId: cycleCode,
      currentLocation: {
        type: "Point",
        coordinates: [lng, lat],
      },
    }),
}
