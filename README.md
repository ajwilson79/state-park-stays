# Ohio State Park Stays

A family trip tracker for all 73 Ohio State Parks. Mark parks as visited, plan future trips with dates, write notes, rate each park, and upload your own photos from visits — all on an interactive map.

## Setup

**Requirements:** Node.js 18+

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The app stores all data locally in a SQLite database (`parks.db`) so it persists across sessions and browser restarts. Any browser on the same machine can access it.

## Features

### Map

The interactive map shows all 73 Ohio State Parks as color-coded markers:

| Color | Meaning |
|-------|---------|
| Gray | Not yet visited |
| Green | Visited |
| Blue | Trip planned |
| Yellow | Currently highlighted (fly-to) |
| Amber ring | Hovered in sidebar |

Hover over any marker to see the park name and status. Click a marker to open the park detail panel.

**Region hover** — hovering a region tab in the sidebar dims all out-of-region markers, highlights the region's parks with an amber ring, and draws a soft rounded boundary around the region.

### Sidebar

The left sidebar lists all parks grouped by region. Use it to:

- **Search** — type any part of a park name to filter the list
- **Filter by region** — click a region tab to narrow the list to one area
- **Hover a region tab** — highlights that region on the map with a polygon and dims everything outside it
- **Click a park** — the map flies to that location and highlights the marker in yellow with a prompt to click it
- **Hover a park** — turns its map marker amber so you can spot it instantly

The header shows your total progress (visited count and percentage) and how many trips are planned.

### Park Detail

Click any map marker to open the detail panel for that park. From here you can:

**Mark as Visited** — toggles the park between visited and unvisited. Marking a park visited automatically removes any planned trip for it.

**Plan a Visit** — click "📅 Plan Visit" to pick a date. The date shows on the map marker tooltip and in the sidebar list. You can change or remove the date at any time.

**Notes** — write freeform notes about the park: trails, campsite tips, things to do, dates you went, etc.

**Rating** — give the park a 1–5 star rating. Click the same star again to clear it.

Notes and rating are saved together when you click **Save**. Planning a visit has its own save button separate from notes.

**Park photo** — the panel shows a photo sourced from Wikipedia or Wikimedia Commons when available.

**Your visit photo** — once a park is marked visited, a "📷 Add a photo from your visit" prompt appears. Upload any image from your device and it becomes the park's hero photo, replacing the default. You can replace or remove it at any time.

### Regions

Parks are organized into 8 regions:

- Greater Cincinnati
- Greater Columbus
- Miami-Scioto Basins
- Northeast Ohio
- Northwest Ohio
- Lake Erie
- Southeast Ohio
- North Central Ohio

## Data

All visit history, planned trips, notes, ratings, and uploaded photos are stored in the project root — `parks.db` (SQLite) and `park-images/` (uploaded photos). Both are excluded from git. Back them up before wiping the project folder.
