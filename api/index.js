const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || '89128691888';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'molotboy';
const SCHEDULE_FILE = 'schedule.json';
const TOKENS_FILE = 'tokens.json';
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json());

// --- Token store ---
const tokens = new Map();

function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function writeJSON(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  const tmp = filepath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filepath);
}

function loadTokens() {
  const data = readJSON(TOKENS_FILE);
  if (!data || !data.tokens) return;
  const now = Date.now();
  for (const [token, session] of Object.entries(data.tokens)) {
    if (session.expiresAt > now) tokens.set(token, session);
  }
}

function persistTokens() {
  const obj = {};
  for (const [token, session] of tokens.entries()) obj[token] = session;
  try { writeJSON(TOKENS_FILE, { tokens: obj }); } catch {}
}

function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { role: 'admin', expiresAt: Date.now() + TOKEN_TTL });
  persistTokens();
  return token;
}

function resolveToken(token) {
  const session = tokens.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) { tokens.delete(token); persistTokens(); return null; }
  return session;
}

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const session = resolveToken(auth.slice(7));
  if (!session || session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// --- Routes ---
app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    return res.json({ token: generateToken() });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

function emptySchedule() { return { groups: [] }; }

function isValidSchedule(data) {
  if (!data || !Array.isArray(data.groups)) return false;
  return data.groups.every(g =>
    g && typeof g.name === 'string' && Array.isArray(g.sessions) &&
    g.sessions.every(s => s && typeof s.day === 'string' && typeof s.start === 'string' && typeof s.end === 'string')
  );
}

app.get('/api/schedule', (req, res) => {
  res.json(readJSON(SCHEDULE_FILE) || emptySchedule());
});

app.put('/api/schedule', adminAuth, (req, res) => {
  if (!isValidSchedule(req.body)) return res.status(400).json({ error: 'Invalid schedule format' });
  writeJSON(SCHEDULE_FILE, req.body);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log('dobrypiter-api running on port ' + PORT);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  loadTokens();
  if (!readJSON(SCHEDULE_FILE)) writeJSON(SCHEDULE_FILE, {
    groups: [
      { name: 'Детская группа', sessions: [
        { day: 'Понедельник', start: '16:00', end: '17:15' },
        { day: 'Среда', start: '16:00', end: '17:15' },
        { day: 'Пятница', start: '16:00', end: '17:15' },
      ]},
      { name: 'Подростковая группа', sessions: [
        { day: 'Понедельник', start: '17:30', end: '18:45' },
        { day: 'Среда', start: '17:30', end: '18:45' },
        { day: 'Пятница', start: '17:30', end: '18:45' },
      ]},
      { name: 'Взрослая группа', sessions: [
        { day: 'Понедельник', start: '20:30', end: '22:00' },
        { day: 'Среда', start: '20:30', end: '22:00' },
        { day: 'Пятница', start: '20:30', end: '22:00' },
      ]},
      { name: 'Женская группа', sessions: [
        { day: 'Вторник', start: '09:30', end: '10:30' },
        { day: 'Четверг', start: '09:30', end: '10:30' },
        { day: 'Суббота', start: '11:00', end: '12:00' },
      ]},
      { name: 'Индивидуальные', sessions: [
        { day: 'Понедельник', start: '10:30', end: '13:30' },
        { day: 'Вторник', start: '07:00', end: '13:00' },
        { day: 'Среда', start: '10:30', end: '13:30' },
        { day: 'Четверг', start: '07:00', end: '13:00' },
        { day: 'Пятница', start: '10:30', end: '13:30' },
        { day: 'Суббота', start: '07:00', end: '14:00' },
      ]},
    ]
  });
});
