// Socket.IO client for device communication
import { io, type Socket } from "socket.io-client"
import type { DeviceStatus, SocketCommand } from "./types"

const RELAY_URL = process.env.REACT_APP_RELAY_URL || "http://localhost:4000"

let socket: Socket | null = null
let deviceStatusListeners: Array<(status: DeviceStatus) => void> = []
let commandResponseListeners: Array<(data: any) => void> = []

export const initializeSocket = (accessToken: string) => {
  if (socket?.connected) return socket

  socket = io(RELAY_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  })

  socket.on("connect", () => {
    console.log("[v0] Socket connected")
    // Register as frontend
    socket?.emit("register", {
      role: "frontend",
      auth: accessToken,
    })
  })

  socket.on("deviceStatus", (data: DeviceStatus) => {
    console.log("[v0] Received deviceStatus:", data)
    deviceStatusListeners.forEach((listener) => listener(data))
  })

  socket.on("command", (data) => {
    console.log("[v0] Received command response:", data)
    commandResponseListeners.forEach((listener) => listener(data))
  })

  socket.on("disconnect", () => {
    console.log("[v0] Socket disconnected")
  })

  socket.on("error", (error) => {
    console.error("[v0] Socket error:", error)
  })

  return socket
}

export const getSocket = () => socket

export const sendCommand = (command: SocketCommand) => {
  if (!socket) {
    console.error("[v0] Socket not connected")
    return
  }
  console.log("[v0] Sending command:", command)
  socket.emit("command", command)
}

export const onDeviceStatus = (callback: (status: DeviceStatus) => void): (() => void) => {
  deviceStatusListeners.push(callback)
  return () => {
    deviceStatusListeners = deviceStatusListeners.filter((l) => l !== callback)
  }
}

export const onCommandResponse = (callback: (data: any) => void): (() => void) => {
  commandResponseListeners.push(callback)
  return () => {
    commandResponseListeners = commandResponseListeners.filter((l) => l !== callback)
  }
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    deviceStatusListeners = []
    commandResponseListeners = []
  }
}
