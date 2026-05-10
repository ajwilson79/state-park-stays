# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # starts both Vite (port 5173) and Express API (port 3001) concurrently
npm run build     # production build of the frontend only
node server.js    # run the API server alone
```

There are no tests and no linter configured.

## Architecture

Two processes run together via `concurrently`:

- **Frontend** — Vite + React at `localhost:5173`
- **Backend** — Express + better-sqlite3 at `localhost:3001`, storing data in `parks.db` (SQLite, gitignored)

The frontend talks to the backend exclusively through `src/lib/api.js`. The API base URL defaults to `http://localhost:3001` and can be overridden with `VITE_API_URL`. The `.env.example` mentions PocketBase — ignore it, that was a previous iteration.

### Data flow

```
ohioParks.js (static)
     │
     ▼
App.jsx  ──── useVisitedParks (hook) ──── api.js ──── server.js ──── parks.db
     │              │
     ├── Sidebar    └── visitedIds (Set), plannedMap (parkId → dateString)
     ├── ParkMap
     └── ParkModal
```

`useVisitedParks` does optimistic updates with rollback on error for all visited/planned mutations.

### Park states and map markers

Each park has one of four visual states, checked in priority order:

| State | Trigger | Marker color |
|-------|---------|-------------|
| flyTarget | sidebar click | yellow `#ffca28` |
| visited | in `visitedIds` Set | green `#4cde5a` |
| planned | in `plannedMap` | blue `#42a5f5` |
| unvisited | default | gray `#cfd8dc` |

**Critical react-leaflet pattern**: `CircleMarker` style is passed via the `pathOptions` prop (not spread directly). The `key` prop includes `visited`, `planned`, and `isFlyTarget` to force remount when state changes — without this, marker colors do not update.

### Interaction model

- **Sidebar park click** → fly map to park + yellow highlight, show hint overlay ("click the marker to view details"). Does NOT open the modal.
- **Map marker click** → open `ParkModal`, clear flyTarget.
- **Hover on sidebar item** → radius grows by 3px on the corresponding map marker (`highlightedId`).

### Database schema

Three tables in `parks.db`:

- `visited_parks(park_id TEXT PK, visited_at TEXT)`
- `park_notes(park_id TEXT PK, notes TEXT, rating INTEGER, updated_at TEXT)` — rating column was added via `ALTER TABLE` with try/catch for existing DBs
- `planned_parks(park_id TEXT PK, planned_date TEXT, created_at TEXT)`

Marking a park visited automatically removes it from `planned_parks` (handled in `useVisitedParks.toggleVisited`).

### Park data

`src/data/ohioParks.js` — 73 Ohio state parks as `{ id, name, lat, lng, region }`. Region is one of 8 areas (e.g. "Greater Cincinnati", "Northeast Ohio"). `src/data/ohioBoundary.json` is a GeoJSON polygon used to draw the dashed Ohio state border on the map.

### Modal behavior

`ParkModal` fetches two things in parallel on open: notes+rating from the local API, and a Wikipedia summary via the public REST API (`en.wikipedia.org/api/rest_v1/page/summary/{parkName}`). The Wikipedia title is derived by replacing spaces with underscores. Notes and rating are saved together via a single Save button — nothing auto-saves except the planned date (which has its own Save/Update button).
