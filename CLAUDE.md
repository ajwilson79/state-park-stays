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

The frontend talks to the backend exclusively through `src/lib/api.js`. The API base URL defaults to `''` (relative, proxied by Vite in dev) and can be overridden with `VITE_API_URL`. Vite proxies `/api` to `http://localhost:3001` in development via `vite.config.js`.

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

Additionally, when a park is hovered in the sidebar (`highlightedId`) or falls within the hovered region (`hoveredRegion`), its marker border changes to amber `#ff9100` and its radius grows by 3–4px. Parks outside a hovered region are dimmed to 8% opacity.

**Critical react-leaflet pattern**: `CircleMarker` style is passed via the `pathOptions` prop (not spread directly). The `key` prop includes `visited`, `planned`, `isFlyTarget`, and `inHoveredRegion` to force remount when state changes — without this, marker colors do not update.

### Interaction model

- **Sidebar park click** → fly map to park + yellow highlight, show hint overlay. Does NOT open the modal.
- **Map marker click** → open `ParkModal`, clear flyTarget.
- **Sidebar park hover** → marker turns amber and grows (`highlightedId`).
- **Sidebar region tab hover** → dims out-of-region markers, highlights in-region markers amber, draws a smoothed convex hull polygon around the region (`hoveredRegion`).

### Region hover polygon

`ParkMap` computes a region polygon via three steps:

1. **`convexHull`** — Jarvis march on the region's park coordinates
2. **`inflate`** — pushes each hull vertex 0.25° outward from the centroid so the polygon encapsulates rather than touches the outermost parks
3. **`chaikin`** — 3 iterations of Chaikin curve subdivision to smooth the angular hull into a soft rounded shape

The result is rendered as a react-leaflet `Polygon` with `interactive: false`. Keyed by `hoveredRegion` to force remount on region change. Computed with `useMemo`.

### Image sourcing (ParkModal)

Three requests fire in parallel when the modal opens:

1. **Notes/rating** — local API (`/api/notes/:parkId`)
2. **Wikipedia summary** — `en.wikipedia.org/api/rest_v1/page/summary/{title}` for description text
3. **Wikipedia page image** — `en.wikipedia.org/w/api.php?prop=pageimages` for a curated 480px photo

Image priority:
1. **User-uploaded photo** — checked via `HEAD /api/images/:parkId` on modal open; if present, skips all external fetches for the image
2. **Wikipedia page image** — used if not flagged as a map/archive (URL checked for `map|locator|relief|blank|survey|NARA|DPLA|chart|diagram`)
3. **Wikimedia Commons search** — `commons.wikimedia.org/w/api.php?generator=search` for landscape JPEGs/PNGs, also filtered by the same URL pattern, sorted by aspect ratio
4. **Nothing** — banner simply doesn't render; `onError` hides it if a URL fails

### User photo upload

`multer` handles file uploads on the backend. Images are stored in `{DATA_DIR}/park-images/{parkId}.{ext}` alongside `parks.db`.

- `GET /api/images/:parkId` — serves the file (tries jpg/jpeg/png/webp)
- `POST /api/images/:parkId` — deletes any existing image then saves the new upload
- `DELETE /api/images/:parkId` — removes the image

In the modal, the upload button only appears when the park is marked visited. A dashed prompt area renders when there is no image at all; an overlay button renders when a default or user image is already showing.

### Database schema

Three tables in `parks.db`:

- `visited_parks(park_id TEXT PK, visited_at TEXT)`
- `park_notes(park_id TEXT PK, notes TEXT, rating INTEGER, updated_at TEXT)` — rating column was added via `ALTER TABLE` with try/catch for existing DBs
- `planned_parks(park_id TEXT PK, planned_date TEXT, created_at TEXT)`

Marking a park visited automatically removes it from `planned_parks` (handled in `useVisitedParks.toggleVisited`).

### Park data

`src/data/ohioParks.js` — 73 Ohio state parks as `{ id, name, lat, lng, region }`. Region is one of 8 areas. `src/data/ohioBoundary.json` is a GeoJSON polygon for the dashed Ohio state border overlay.
