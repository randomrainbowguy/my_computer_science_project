const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory stores
const sessions = new Map();

// Access codes from environment variables
const ACCESS_CODES = {
  'proxy': process.env.PROXY_CODE || 'secure2025',
  'chat': process.env.CHAT_CODE || 'atlas-chat'
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin-atlas-2025';

// Routes
app.post('/api/auth/access', (req, res) => {
  const { code } = req.body;
  console.log('Access attempt with code:', code);
  
  if (!code) {
    return res.status(400).json({ error: 'Code required' });
  }

  const service = Object.keys(ACCESS_CODES).find(key => ACCESS_CODES[key] === code);
  
  if (!service) {
    console.log('Invalid access code:', code);
    return res.status(401).json({ error: 'Invalid access code' });
  }

  const sessionId = Math.random().toString(36).substring(7);
  sessions.set(sessionId, { service, createdAt: Date.now() });
  
  console.log('Session created:', sessionId, 'for service:', service);

  res.json({ 
    success: true, 
    service, 
    sessionId,
    redirectUrl: service === 'proxy' ? '/proxy' : '/chat.html'
  });
});

app.get('/api/proxy-url', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  console.log('Proxy request - Session ID from header:', sessionId);
  console.log('Available sessions:', Array.from(sessions.entries()));
  
  // If no specific session, try to find any proxy session (temporary workaround)
  let session = sessions.get(sessionId);
  
  if (!session) {
    // Find any proxy session as fallback
    for (let [id, sess] of sessions.entries()) {
      if (sess.service === 'proxy') {
        session = sess;
        console.log('Using fallback session:', id);
        break;
      }
    }
  }
  
  if (!session) {
    console.log('No proxy session found at all');
    return res.status(401).json({ error: 'No valid proxy session' });
  }
  
  if (session.service !== 'proxy') {
    console.log('Wrong service type. Expected proxy, got:', session.service);
    return res.status(401).json({ error: 'Invalid session - wrong service' });
  }

  console.log('Returning proxy URL');
  res.json({ 
    url: process.env.PROXY_URL || "https://blue-sky-123.ddx.blocksi.lol.cdn.cloudflare.net"
  });
});

app.post('/api/auth/admin', (req, res) => {
  const { password, username } = req.body;
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }

  const adminToken = jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET || 'temp-secret-key',
    { expiresIn: '2h' }
  );

  res.json({ success: true, token: adminToken });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    sessions: sessions.size,
    codes: Object.keys(ACCESS_CODES)
  });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Access codes: proxy=${ACCESS_CODES.proxy}, chat=${ACCESS_CODES.chat}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
});