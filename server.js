import express from 'express'
import Database from 'better-sqlite3'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, mkdirSync, unlinkSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATA_DIR || __dirname
const db = new Database(join(dataDir, 'parks.db'))

const imagesDir = join(dataDir, 'park-images')
if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp']

function findParkImage(parkId) {
  for (const ext of IMAGE_EXTS) {
    const p = join(imagesDir, `${parkId}.${ext}`)
    if (existsSync(p)) return p
  }
  return null
}

const upload = multer({
  storage: multer.diskStorage({
    destination: imagesDir,
    filename: (req, file, cb) => {
      const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg'
      cb(null, `${req.params.parkId}.${ext}`)
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only'))
  },
})

db.exec(`
  CREATE TABLE IF NOT EXISTS visited_parks (
    park_id TEXT PRIMARY KEY,
    visited_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS park_notes (
    park_id TEXT PRIMARY KEY,
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS planned_parks (
    park_id TEXT PRIMARY KEY,
    planned_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS park_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    park_id TEXT NOT NULL,
    visited_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

// Add rating column if this is an existing DB without it
try { db.exec('ALTER TABLE park_notes ADD COLUMN rating INTEGER') } catch {}

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:5173')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

app.get('/api/visited', (req, res) => {
  const rows = db.prepare('SELECT park_id, visited_at FROM visited_parks').all()
  res.json(rows)
})

app.post('/api/visited/:parkId', (req, res) => {
  db.prepare('INSERT OR IGNORE INTO visited_parks (park_id) VALUES (?)').run(req.params.parkId)
  res.json({ park_id: req.params.parkId })
})

app.delete('/api/visited/:parkId', (req, res) => {
  db.prepare('DELETE FROM visited_parks WHERE park_id = ?').run(req.params.parkId)
  res.json({ ok: true })
})

app.get('/api/notes/:parkId', (req, res) => {
  const row = db.prepare('SELECT notes, rating FROM park_notes WHERE park_id = ?').get(req.params.parkId)
  res.json({ notes: row?.notes ?? '', rating: row?.rating ?? 0 })
})

app.put('/api/notes/:parkId', (req, res) => {
  const { notes, rating } = req.body
  db.prepare(`
    INSERT INTO park_notes (park_id, notes, rating, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(park_id) DO UPDATE SET notes = excluded.notes, rating = excluded.rating, updated_at = excluded.updated_at
  `).run(req.params.parkId, notes ?? '', rating ?? null)
  res.json({ ok: true })
})

app.get('/api/planned', (req, res) => {
  const rows = db.prepare('SELECT park_id, planned_date FROM planned_parks').all()
  res.json(rows)
})

app.put('/api/planned/:parkId', (req, res) => {
  const { planned_date } = req.body
  db.prepare(`
    INSERT INTO planned_parks (park_id, planned_date) VALUES (?, ?)
    ON CONFLICT(park_id) DO UPDATE SET planned_date = excluded.planned_date
  `).run(req.params.parkId, planned_date ?? null)
  res.json({ ok: true })
})

app.delete('/api/planned/:parkId', (req, res) => {
  db.prepare('DELETE FROM planned_parks WHERE park_id = ?').run(req.params.parkId)
  res.json({ ok: true })
})

app.get('/api/visits', (req, res) => {
  const rows = db.prepare('SELECT park_id, COUNT(*) as count FROM park_visits GROUP BY park_id').all()
  res.json(rows)
})

app.get('/api/visits/:parkId', (req, res) => {
  const rows = db.prepare('SELECT id, visited_date FROM park_visits WHERE park_id = ? ORDER BY visited_date DESC').all(req.params.parkId)
  res.json(rows)
})

app.post('/api/visits/:parkId', (req, res) => {
  const { visited_date } = req.body
  if (!visited_date) return res.status(400).json({ error: 'visited_date required' })
  const result = db.prepare('INSERT INTO park_visits (park_id, visited_date) VALUES (?, ?)').run(req.params.parkId, visited_date)
  res.json({ id: result.lastInsertRowid, park_id: req.params.parkId, visited_date })
})

app.delete('/api/visits/:parkId/:visitId', (req, res) => {
  db.prepare('DELETE FROM park_visits WHERE id = ? AND park_id = ?').run(req.params.visitId, req.params.parkId)
  res.json({ ok: true })
})

app.get('/api/images/:parkId', (req, res) => {
  const file = findParkImage(req.params.parkId)
  if (file) return res.sendFile(file)
  res.status(404).json({ error: 'No image' })
})

app.post('/api/images/:parkId', (req, res, next) => {
  // Delete any existing image for this park before saving new one
  const existing = findParkImage(req.params.parkId)
  if (existing) unlinkSync(existing)
  next()
}, upload.single('photo'), (req, res) => {
  res.json({ ok: true })
})

app.delete('/api/images/:parkId', (req, res) => {
  const file = findParkImage(req.params.parkId)
  if (file) unlinkSync(file)
  res.json({ ok: true })
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')))
  app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')))
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
