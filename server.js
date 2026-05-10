import express from 'express'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(process.env.DATA_DIR || __dirname, 'parks.db'))

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

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')))
  app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')))
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
