# PedalUp Frontend

A React + TypeScript frontend for PedalUp — a campus rental cycle service with real-time GPS tracking, Arduino lock integration via Socket.IO relay, and comprehensive ride lifecycle management.

## Features

- **User Authentication**: Secure JWT-based auth with automatic token refresh
- **Map Dashboard**: Interactive canvas-based map showing cycle locations
- **Cycle Listing**: Browse available and in-use cycles with ratings
- **Ride Management**: Request, track, and complete rides with real-time updates
- **Real-time Lock Status**: Socket.IO integration for device command execution
- **Device Simulator**: Developer panel for testing device events
- **Responsive Design**: Mobile-first UI that works on all devices

## Prerequisites

Before running this frontend, ensure you have:

1. **Backend Service** running at `http://localhost:8080`
   - GitHub: https://github.com/Souvik0001/PedalUp
   - Follow backend setup instructions

2. **Socket.IO Relay** running at `http://localhost:4000`
   - Relays device commands between frontend and simulated Arduino devices
   - Example relay setup (Node.js):
     \`\`\`bash
     npm install socket.io
     node relay-server.js
     \`\`\`

3. **Proxy Server** (for cookie rewriting)
   - **CRITICAL**: Backend sets httpOnly cookie named `token`, but the refresh endpoint expects `refreshToken`
   - Frontend environment MUST use a proxy that rewrites the cookie name
   - Options:
     - Use a reverse proxy (nginx, Apache)
     - Use Node.js middleware proxy
     - Configure CORS and cookie handling in development

## Setup & Installation

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

\`\`\`env
# Backend API base URL (use proxy URL if you have cookie rewriting proxy)
REACT_APP_API_BASE=http://localhost:8080

# Socket.IO Relay URL for device communication
REACT_APP_RELAY_URL=http://localhost:4000
\`\`\`

### 3. Understanding the Cookie Rewrite Requirement

**The Challenge**: Backend sets `Set-Cookie: token=...` but `/auth/refresh` expects cookie name `refreshToken`.

**Frontend Solution**: Use a proxy that rewrites cookies:

#### Option A: Node.js Proxy (Recommended for Development)

\`\`\`javascript
// proxy.js
const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

http.createServer((req, res) => {
  req.url = req.url || '/';
  
  proxy.on('proxyRes', (proxyRes, req, res) => {
    if (proxyRes.headers['set-cookie']) {
      proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie =>
        cookie.replace(/^token=/, 'refreshToken=')
      );
    }
  });
  
  proxy.web(req, res, { target: 'http://localhost:8080' });
}).listen(3001);

console.log('Proxy listening on http://localhost:3001');
\`\`\`

Then set in `.env.local`:
\`\`\`env
REACT_APP_API_BASE=http://localhost:3001
\`\`\`

#### Option B: Nginx Configuration

\`\`\`nginx
location /auth/ {
    proxy_pass http://localhost:8080;
    proxy_cookie_path ~^/(.*) /$1;
    proxy_cookie_name "token" "refreshToken";
}
\`\`\`

#### Option C: Use `httpProxy` Middleware

Install: `npm install http-proxy-middleware`

### 4. Verify Cookie Setup (Important!)

After login, check that the `refreshToken` cookie exists:

1. Open Browser Dev Tools → Application → Cookies
2. Look for `refreshToken` cookie on your domain
3. If missing or named `token`, the proxy rewrite is not working
4. Check proxy logs and CORS settings

## Running the Application

### Development Mode

\`\`\`bash
npm run dev
\`\`\`

Visit `http://localhost:3000` in your browser.

### Production Build

\`\`\`bash
npm run build
npm start
\`\`\`

## Complete Running Instructions

### Step 1: Start Backend Service

\`\`\`bash
cd ../backend  # Navigate to backend directory
# Follow backend README for setup
java -jar pedalup-0.0.1-SNAPSHOT.jar  # or: mvn spring-boot:run
# Backend runs on http://localhost:8080
\`\`\`

### Step 2: Start Socket.IO Relay

\`\`\`bash
# Create relay-server.js (see example above)
node relay-server.js
# Relay runs on http://localhost:4000
\`\`\`

### Step 3: Start Proxy (if needed)

\`\`\`bash
# If using Node.js proxy
node proxy.js
# Proxy runs on http://localhost:3001
# Update REACT_APP_API_BASE to http://localhost:3001
\`\`\`

### Step 4: Start Frontend

\`\`\`bash
npm install
npm run dev
# Frontend runs on http://localhost:3000
\`\`\`

### Step 5: Test Device Simulator (Dev Mode Only)

1. Open `http://localhost:3000/dashboard`
2. Click "Dev: Device Simulator" button in bottom-right
3. Click "Connect to Relay"
4. Send status, toggle lock, or enable auto-update
5. Observe real-time updates via Socket.IO

## Testing Workflow

### Test Complete Ride Flow

1. **Signup & Login**
   - Go to `/signup` and create an account
   - Login with credentials
   - Verify `refreshToken` cookie is set

2. **Browse Cycles**
   - View map or list of cycles
   - Toggle between Map/List views
   - Click a cycle to see details

3. **Request a Ride**
   - Click "Request Ride" on an available cycle
   - You'll be redirected to ride page
   - Observe active ride timer and cycle lock status

4. **Use Device Simulator**
   - Open device simulator panel
   - Connect to relay
   - Send unlock command
   - Watch ride page lock status update
   - End ride and view summary

5. **Automatic Token Refresh**
   - Stay logged in past token expiry (default 10 min)
   - Interceptor will automatically refresh token
   - Session continues without redirect

## API Integration Details

### Token Refresh Flow (Automatic)

\`\`\`
User Request (401)
    ↓
Axios Interceptor catches 401
    ↓
POST /auth/refresh with withCredentials:true
    ↓
Browser sends refreshToken cookie
    ↓
Backend returns new accessToken
    ↓
Interceptor retries original request with new token
\`\`\`

### Socket.IO Event Flow

\`\`\`
Frontend → command event → Relay → device event → Simulated Device
Device → status event → Relay → deviceStatus event → Frontend
\`\`\`

## Troubleshooting

### "Refresh token invalid/expired" Error

**Problem**: Cookie not being sent to backend

**Solution**:
1. Check if `refreshToken` cookie exists (not `token`)
2. Verify proxy is rewriting cookies
3. Ensure frontend uses `withCredentials: true`
4. Check CORS settings on backend

### Device Simulator Not Receiving Commands

**Problem**: Socket.IO connection issues

**Solution**:
1. Verify relay is running on `http://localhost:4000`
2. Check browser console for Socket.IO errors
3. Verify `REACT_APP_RELAY_URL` is correct
4. Check relay CORS configuration

### "Cycle not available" Error on Ride Request

**Problem**: Another user booked the cycle

**Solution**: Click Refresh to see updated cycle list

### Map Not Showing Cycles

**Problem**: API call failing

**Solution**:
1. Verify backend is running
2. Check access token is being sent (Authorization header)
3. Verify `REACT_APP_API_BASE` is correct
4. Check browser network tab for errors

## Project Structure

\`\`\`
src/
├── app/                      # Next.js app router pages
│   ├── layout.tsx           # Root layout with AuthProvider
│   ├── page.tsx             # Root page (redirects to dashboard/login)
│   ├── login/               # Login page
│   ├── signup/              # Signup page
│   ├── dashboard/           # Main dashboard with map
│   └── ride/                # Active ride page
├── components/
│   ├── login-form.tsx       # Login form
│   ├── signup-form.tsx      # Signup form
│   ├── map-container.tsx    # Interactive cycle map
│   ├── cycle-detail-modal.tsx  # Cycle details popup
│   ├── cycle-list.tsx       # Cycle listing
│   ├── active-ride-view.tsx # Ride tracker UI
│   ├── ride-request-status.tsx # Ride request status
│   └── device-simulator.tsx # Dev device simulator panel
├── contexts/
│   └── auth-context.tsx     # Authentication state management
├── hooks/
│   ├── use-cycles.ts        # Cycle data fetching
│   └── use-ride.ts          # Ride lifecycle management
├── lib/
│   ├── types.ts             # TypeScript interfaces
│   ├── api-client.ts        # Axios instance with interceptors
│   ├── api-endpoints.ts     # API function wrappers
│   └── socket-client.ts     # Socket.IO client
└── app/
    └── globals.css          # Global styles with design tokens
\`\`\`

## Key Features Explained

### Auto Token Refresh

- Tokens stored in memory (not localStorage for security)
- Background interval checks token expiry every 30s
- Failed refresh redirects to login
- Axios interceptor handles 401 responses

### Map Interaction

- **Drag**: Pan the map
- **Scroll**: Zoom in/out (0.5x to 3x)
- **Click**: Select cycle

### Real-time Updates

- Socket.IO listens for `deviceStatus` events
- Automatically updates lock state and location
- Used by device simulator and Arduino devices

### Device Simulator (Dev Only)

- Enabled only in development (`NODE_ENV !== 'production'`)
- Simulates Arduino device via Socket.IO
- Test commands: unlock, lock, location updates
- Auto-update for continuous GPS simulation

## Performance Considerations

- Cycles fetched every 30 seconds (configurable)
- Ride status polled every 5 seconds during active ride
- Token refresh checked every 30 seconds
- Socket.IO reconnects automatically with exponential backoff
- All long-running operations use abortable requests

## Security Notes

- Access tokens stored in memory only (no localStorage)
- HttpOnly cookies prevent XSS attacks
- All protected endpoints require Authorization header
- Refresh token rotation supported
- CORS and credential handling enforced

## Development Tips

- Use browser DevTools Network tab to inspect API calls
- Check Console for `[v0]` prefixed debug logs
- Device Simulator logs all Socket.IO events
- Inspect cookies: Application → Cookies
- Test with slow 3G in Network throttling

## Contributing

When making changes:

1. Follow TypeScript strict mode
2. Use semantic HTML and ARIA attributes
3. Test with device simulator before deployment
4. Verify token refresh with expired tokens
5. Check responsive design on mobile

## License

MIT - See LICENSE file for details

## Support

For issues:
1. Check troubleshooting section above
2. Review browser console for error messages
3. Verify all services are running (backend, relay, proxy)
4. Check environment variables are set correctly
