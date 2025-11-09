/**
 * Example Socket.IO Relay Server
 *
 * This relay server bridges frontend and simulated Arduino devices.
 * Forwards commands from frontend to devices and status updates back.
 *
 * Usage:
 *   npm install socket.io
 *   node relay-server.js
 */

const { createServer } = require("http")
const { Server } = require("socket.io")

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Track connected devices
const devices = new Map()
const frontends = new Map()

io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`)

  // Registration handler
  socket.on("register", (data) => {
    const { role, cycleId, auth } = data

    if (role === "device") {
      devices.set(socket.id, { cycleId, socket })
      socket.join(`cycle-${cycleId}`)
      console.log(`[Device] Registered: ${cycleId} (${socket.id})`)
    } else if (role === "frontend") {
      frontends.set(socket.id, { socket, auth })
      console.log(`[Frontend] Connected: ${socket.id}`)
    }
  })

  // Command handler (frontend → device)
  socket.on("command", (data) => {
    const { cycleId, command, meta } = data
    console.log(`[Command] From ${socket.id}: ${command} on ${cycleId}`)

    // Broadcast command to device room
    io.to(`cycle-${cycleId}`).emit("command", {
      command,
      meta,
      timestamp: Date.now(),
    })

    // Echo back to frontend
    socket.emit("command", {
      status: "sent",
      command,
      cycleId,
      timestamp: Date.now(),
    })
  })

  // Status handler (device → frontend)
  socket.on("status", (data) => {
    const { cycleId, status } = data
    console.log(`[Status] From ${socket.id}: ${cycleId} @ ${status.lat.toFixed(4)}, ${status.lng.toFixed(4)}`)

    // Broadcast to all frontends
    io.emit("deviceStatus", {
      cycleId,
      status,
      receivedAt: Date.now(),
    })
  })

  socket.on("disconnect", () => {
    devices.delete(socket.id)
    frontends.delete(socket.id)
    console.log(`[Socket] Client disconnected: ${socket.id}`)
  })

  socket.on("error", (error) => {
    console.error(`[Socket Error] ${socket.id}:`, error)
  })
})

const PORT = process.env.PORT || 4000
httpServer.listen(PORT, () => {
  console.log(`Socket.IO Relay listening on http://localhost:${PORT}`)
})
