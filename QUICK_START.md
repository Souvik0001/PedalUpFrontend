# Quick Start Guide - PedalUp Frontend (Port 8080)

## Prerequisites

Ensure your backend is running at **http://localhost:8080**

## Step-by-Step Setup

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

If you get dependency errors, use:
\`\`\`bash
npm install --legacy-peer-deps
\`\`\`

### 2. Create .env.local

The project already defaults to port 8080, but create `.env.local` to be explicit:

\`\`\`env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_SOCKET_SERVER_URL=http://localhost:4000
\`\`\`

**Note**: The API client uses these variables:
- `REACT_APP_API_BASE` (will use `http://localhost:8080` by default)
- `REACT_APP_RELAY_URL` (for Socket.IO relay)

### 3. Start Frontend

\`\`\`bash
npm run dev
\`\`\`

Frontend will run on `http://localhost:3000`

### 4. Test the Connection

1. Open `http://localhost:3000` in browser
2. Go to **Sign Up** page
3. Create a test account
4. You should see API request to `http://localhost:8080/auth/signup`
5. Login and verify you see cycles from your backend

## Running All Services Together

Open 4 terminal windows:

\`\`\`bash
# Terminal 1: Backend (your service on port 8080)
# Already running

# Terminal 2: Frontend
npm run dev
# Runs on http://localhost:3000

# Terminal 3: Socket.IO Relay (optional, for real-time device updates)
node scripts/relay-server-example.js
# Runs on http://localhost:4000

# Terminal 4: Proxy server (ONLY if you need cookie rewriting)
node scripts/proxy-server-example.js
# Runs on http://localhost:3001
\`\`\`

## Environment Variables Explained

| Variable | Default | Purpose |
|----------|---------|---------|
| `REACT_APP_API_BASE` | `http://localhost:8080` | Backend API endpoint |
| `REACT_APP_RELAY_URL` | `http://localhost:4000` | Socket.IO relay for device commands |

## Cookie/Token Flow

\`\`\`
Login Request
    ↓
Backend returns: Set-Cookie: token=<jwt>
    ↓
Browser stores token cookie
    ↓
Auto Token Refresh (every 30s if needed)
    ↓
POST /auth/refresh with cookie
    ↓
Backend returns new accessToken
\`\`\`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **"Cannot POST /auth/signup"** | Backend not running on port 8080. Check `REACT_APP_API_BASE` |
| **401 Unauthorized** | Token refresh failed. Check browser cookies - should have `token` or `refreshToken` |
| **CORS errors** | Backend CORS config issue. Verify backend allows `localhost:3000` |
| **Map not loading cycles** | Check Network tab - cycles API should return from `http://localhost:8080/cycles` |
| **Socket.IO not connecting** | Relay not running. Start `node scripts/relay-server-example.js` |

## API Endpoints Used

Your backend should have these endpoints:

\`\`\`
POST   /auth/signup              - User registration
POST   /auth/login               - User login
POST   /auth/refresh             - Token refresh
GET    /cycles                   - List all cycles
GET    /cycles/:id               - Get cycle details
POST   /rides                    - Request a ride
GET    /rides/:id                - Get ride details
PUT    /rides/:id/end            - End an active ride
\`\`\`

## Development Features

- **Device Simulator** (Dev mode only): Click "Dev: Device Simulator" on dashboard
- **Hot Reload**: Changes saved automatically
- **Console Logs**: Check browser console for `[v0]` prefixed debug messages

## Verification Checklist

- [ ] Backend running at `http://localhost:8080`
- [ ] Frontend running at `http://localhost:3000`
- [ ] Can create account (check Network tab)
- [ ] Can login successfully
- [ ] Cycles appear on dashboard map
- [ ] `refreshToken` or `token` cookie exists in browser
- [ ] Can request a ride

## Next Steps

Once verified:
1. Test all ride workflows
2. Use Device Simulator to test lock commands
3. Check Socket.IO real-time updates
4. Review your backend logs for any issues

For full details, see **README.md**
