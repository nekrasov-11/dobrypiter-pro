const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const ADMIN_LOGIN = process.env.ADMIN_LOGIN;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

if (!ADMIN_LOGIN || !ADMIN_PASSWORD_HASH) {
  process.stderr.write(
    'FATAL: не заданы переменные окружения ADMIN_LOGIN и/или ADMIN_PASSWORD_HASH.\n' +
    'Задайте их в /etc/dobrypiter/api.env (см. README.md).\n' +
    'Хэш пароля генерируется скриптом: node generate-password-hash.js <пароль>\n'
  );
  process.exit(1);
}

const hashParts = ADMIN_PASSWORD_HASH.split(':');
// Длины фиксированы генератором: salt 16 байт (32 hex), хэш 64 байта (128 hex).
// Нечётный/укороченный hex дал бы пустые буферы и пропуск любого пароля.
if (hashParts.length !== 3 || hashParts[0] !== 'scrypt' || !/^[0-9a-f]{32}$/i.test(hashParts[1]) || !/^[0-9a-f]{128}$/i.test(hashParts[2])) {
  process.stderr.write(
    'FATAL: ADMIN_PASSWORD_HASH имеет неверный формат. Ожидается scrypt:<salt_hex>:<hash_hex>.\n' +
    'Сгенерируйте заново: node generate-password-hash.js <пароль>\n'
  );
  process.exit(1);
}
const PASSWORD_SALT = Buffer.from(hashParts[1], 'hex');
const PASSWORD_HASH = Buffer.from(hashParts[2], 'hex');

const SCHEDULE_FILE = 'schedule.json';
const TOKENS_FILE = 'tokens.json';
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;

app.use(express.json());

// --- Credential checks (constant-time) ---
function safeEqualStrings(a, b) {
  // Выравниваем длину, чтобы timingSafeEqual не кидал исключение
  const bufA = Buffer.from(String(a), 'utf-8');
  const bufB = Buffer.from(String(b), 'utf-8');
  const len = Math.max(bufA.length, bufB.length, 1);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  bufA.copy(padA);
  bufB.copy(padB);
  return crypto.timingSafeEqual(padA, padB) && bufA.length === bufB.length;
}

function verifyPassword(password) {
  const derived = crypto.scryptSync(String(password), PASSWORD_SALT, PASSWORD_HASH.length);
  return crypto.timingSafeEqual(derived, PASSWORD_HASH);
}

// --- Rate limit для /api/login ---
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map(); // ip -> { count, firstAt }

function clientIP(req) {
  // X-Real-IP ставит nginx из $remote_addr — клиент подделать его не может,
  // в отличие от X-Forwarded-For, куда nginx дописывает присланное клиентом
  const realIP = req.headers['x-real-ip'];
  if (typeof realIP === 'string' && realIP.length > 0) {
    return realIP.trim();
  }
  return req.ip;
}

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (now - entry.firstAt > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
  }
}, 60 * 1000).unref();

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
  const ip = clientIP(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Слишком много попыток входа. Попробуйте через 15 минут.' });
  }
  const { login, password } = req.body || {};
  const loginOk = safeEqualStrings(login || '', ADMIN_LOGIN);
  const passwordOk = verifyPassword(password || '');
  if (loginOk && passwordOk) {
    loginAttempts.delete(ip);
    return res.json({ token: generateToken() });
  }
  recordFailedAttempt(ip);
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

// Только localhost: снаружи API ходит через nginx-прокси, прямой доступ к порту не нужен
app.listen(PORT, '127.0.0.1', () => {
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
