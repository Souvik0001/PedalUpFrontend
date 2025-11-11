// PedalUp Arduino Bridge (robust):
// - Listens to multiple Socket.IO event names
// - (Optional) polls /cycles to infer ride from availability
// - Provides local HTTP endpoints to test LED without the app
//
// Deps: npm i serialport socket.io-client dotenv axios express

require('dotenv').config();
const { SerialPort } = require('serialport');
const io = require('socket.io-client');
const axios = require('axios');
const express = require('express');

// --------- ENV ---------
const RELAY_URL   = process.env.RELAY_URL   || 'http://localhost:4000';
const CYCLE_CODE  = String(process.env.CYCLE_CODE || '1003'); // e.g. 1003
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';        // Windows: COMx, Linux/Mac: /dev/ttyACM0
const BAUD        = Number(process.env.BAUD || 9600);
const DRY_RUN     = /^true$/i.test(process.env.DRY_RUN || 'false');

// Optional REST poll (through your proxy)
const API_BASE    = process.env.API_BASE;                      // e.g. http://localhost:3001
const API_EMAIL   = process.env.API_EMAIL || '';               // email to login (optional)
const API_PASS    = process.env.API_PASS  || '';               // password (optional)
const POLL_MS     = Number(process.env.POLL_MS || 3000);       // poll /cycles every 3s when API_BASE set

// --------- Serial (Arduino) ----------
let port = null;
async function openSerial() {
  if (DRY_RUN) {
    console.log('[BRIDGE] DRY_RUN: not opening serial.');
    return;
  }
  port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD });
  port.on('open',   () => console.log(`[BRIDGE] Serial open -> ${SERIAL_PORT} @ ${BAUD}`));
  port.on('error',  (e) => console.error('[BRIDGE] Serial error:', e.message));
  port.on('data',   (d) => process.stdout.write(`[BRIDGE] ← ${d.toString()}`));
}

function setLed(on) {
  const line = on ? 'LED:1\n' : 'LED:0\n';
  if (DRY_RUN || !port) {
    console.log(`[BRIDGE] LED ${on ? 'ON' : 'OFF'} (simulated)`);
    return;
  }
  port.write(line, (err) => {
    if (err) console.error('[BRIDGE] Serial write error:', err.message);
    else     console.log(`[BRIDGE] → ${line.trim()}`);
  });
}

// --------- Socket wiring ----------
function matchesCycle(payload) {
  const id = payload?.cycleId ?? payload?.cycle_id ?? payload?.cycle ?? payload?.id;
  return String(id) === CYCLE_CODE;
}

function attachSocketHandlers(socket) {
  const logAll = (event) => (data) => {
    console.log(`[SOCKET] ${event}:`, safeStr(data));
  };

  // log a bunch of common events to learn what's emitted in your stack
  ['command','device:command','server:command','lock','unlock','status','ride','event','message']
    .forEach(ev => socket.on(ev, logAll(ev)));

  // Toggle LED based on command-like events
  const handleCommandShape = (data) => {
    if (!data) return;
    // common shapes: { cycleId, command: 'unlock'|'lock' }
    const cmd = data.command || data.type || data.action || data.event;
    if (!matchesCycle(data)) return;
    if (/unlock/i.test(String(cmd))) setLed(true);
    if (/lock/i.test(String(cmd)))   setLed(false);
  };
  socket.on('command',         handleCommandShape);
  socket.on('device:command',  handleCommandShape);
  socket.on('server:command',  handleCommandShape);
  socket.on('lock', (d)   => { if (matchesCycle(d)) setLed(false); });
  socket.on('unlock', (d) => { if (matchesCycle(d)) setLed(true);  });

  // Fallback: map status.lock if you emit lock state in status payloads
  socket.on('status', (data) => {
    try {
      if (!matchesCycle(data)) return;
      const lock = data?.status?.lock || data?.lock;
      if (lock === 'unlocked') setLed(true);
      if (lock === 'locked')   setLed(false);
    } catch {}
  });
}

// --------- Optional REST polling (/cycles) ----------
let bearer = '';
async function loginIfNeeded() {
  if (!API_BASE || !API_EMAIL || !API_PASS) return;
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email: API_EMAIL, password: API_PASS
    }, { withCredentials: true });
    const token = res?.data?.accessToken || res?.data?.token || res?.data?.access_token;
    if (token) {
      bearer = token;
      console.log('[BRIDGE] Logged in for polling.');
    } else {
      console.warn('[BRIDGE] Login did not return token; polling may fail.');
    }
  } catch (e) {
    console.warn('[BRIDGE] Login failed; polling disabled:', e?.response?.status, e?.response?.data || e.message);
  }
}

async function pollCyclesOnce() {
  if (!API_BASE) return;
  try {
    const res = await axios.get(`${API_BASE}/cycles`, {
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
      withCredentials: true
    });
    const payload = res.data?.data ?? res.data;
    const list = Array.isArray(payload?.cycles) ? payload.cycles : payload;
    const row = (list || []).find(c => String(c?.cycleId) === CYCLE_CODE);
    if (!row) return;

    const available = row?.available === true;
    // Our rule: LED ON when ride is started (not available), OFF when available
    setLed(!available);
  } catch (e) {
    const s = e?.response?.status;
    if (s === 401) {
      // try to refresh token by logging in again (if creds provided)
      await loginIfNeeded();
    } else {
      console.warn('[BRIDGE] Poll error:', s, e?.response?.data || e.message);
    }
  }
}

function startPolling() {
  if (!API_BASE) return;
  setInterval(pollCyclesOnce, POLL_MS);
  pollCyclesOnce(); // immediate
}

// --------- Tiny local HTTP toggles (for instant testing) ----------
function startLocalHttp() {
  const app = express();
  const PORT = Number(process.env.BRIDGE_HTTP_PORT || 5055);

  app.get('/led/on',  (_req,res) => { setLed(true);  res.json({ok:true}); });
  app.get('/led/off', (_req,res) => { setLed(false); res.json({ok:true}); });
  app.get('/health',  (_req,res) => { res.json({ok:true, cycle: CYCLE_CODE}); });

  app.listen(PORT, () => console.log(`[BRIDGE] Local HTTP on http://localhost:${PORT} (GET /led/on, /led/off)`));
}

// --------- Utils ----------
const safeStr = (o) => {
  try { return JSON.stringify(o); } catch { return String(o); }
};

// --------- Main ----------
(async function main() {
  await openSerial();

  // Socket to relay
  console.log(`[BRIDGE] Connecting to relay: ${RELAY_URL}`);
  const socket = io(RELAY_URL, { transports: ['websocket'] });
  socket.on('connect', () => {
    console.log('[BRIDGE] Relay connected, id=', socket.id);
    socket.emit('register', { role: 'arduino-bridge', cycleId: CYCLE_CODE });
  });
  socket.on('disconnect', () => console.log('[BRIDGE] Relay disconnected'));
  socket.on('connect_error', (e) => console.error('[BRIDGE] Relay error:', e.message));
  attachSocketHandlers(socket);

  // Optional REST polling (if you set API_BASE and optionally credentials)
  if (API_BASE) await loginIfNeeded();
  if (API_BASE) startPolling();

  // Local manual toggles
  startLocalHttp();

  // heartbeat
  setInterval(() => console.log('[BRIDGE] heartbeat… listening for', CYCLE_CODE), 30000);
})();
