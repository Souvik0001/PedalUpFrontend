/**
 * Cookie Rewrite Proxy Server (Node.js - No Dependencies)
 *
 * Rewrites backend cookie from "token" to "refreshToken"
 * and fixes the cookie path from /auth to /
 * so the frontend can access the token on all routes.
 *
 * Usage:
 *   node scripts/proxy-server-example.js
 */

const http = require("http")
const { URL } = require("url")

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080"
const PORT = process.env.PORT || 3001
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"

const server = http.createServer((req, res) => {
  // Parse the backend URL
  const backendUrlObj = new URL(BACKEND_URL)

  const targetUrl = new URL(req.url, BACKEND_URL)

  res.setHeader("Access-Control-Allow-Origin", FRONTEND_URL)
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Set-Cookie")

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(200)
    res.end()
    return
  }

  // Forward the request to the backend
  const backendReq = http.request(
    {
      hostname: backendUrlObj.hostname,
      port: backendUrlObj.port || 80,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: backendUrlObj.host,
      },
    },
    (backendRes) => {
      const setCookieHeaders = backendRes.headers["set-cookie"] || []
      const rewrittenCookies = Array.isArray(setCookieHeaders)
        ? setCookieHeaders.map((cookie) => {
            // Rename "token" to "refreshToken"
            let rewritten = cookie.replace(/^token=/i, "refreshToken=")
            // Change Path=/auth to Path=/
            rewritten = rewritten.replace(/Path=\/auth/i, "Path=/")
            console.log("[v0] Original cookie:", cookie)
            console.log("[v0] Rewritten cookie:", rewritten)
            return rewritten
          })
        : []

      // Set rewritten cookies
      if (rewrittenCookies.length > 0) {
        res.setHeader("set-cookie", rewrittenCookies)
      }

      // Copy other headers from backend response
      Object.keys(backendRes.headers).forEach((key) => {
        if (key !== "set-cookie") {
          res.setHeader(key, backendRes.headers[key])
        }
      })

      res.writeHead(backendRes.statusCode)

      // Pipe the response body
      backendRes.pipe(res)
    },
  )

  backendReq.on("error", (err) => {
    console.error("[v0] Proxy error:", err.message)
    res.writeHead(502, { "Content-Type": "text/plain" })
    res.end(`Bad Gateway: ${err.message}`)
  })

  // Forward the request body if present
  req.pipe(backendReq)
})

server.listen(PORT, () => {
  console.log(`\n✅ Proxy server listening on http://localhost:${PORT}\n`)
  console.log(`📍 Forwarding to backend: ${BACKEND_URL}`)
  console.log(`🌐 Frontend URL: ${FRONTEND_URL}`)
  console.log(`🍪 Rewriting cookies: token → refreshToken`)
  console.log(`📍 Fixing cookie path: Path=/auth → Path=/\n`)
})
