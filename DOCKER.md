# Docker Deployment Guide

This app runs as a single Docker container: Express serves the built React frontend as static files and handles all API requests. Park data is persisted in a SQLite database on a mounted volume so it survives container updates.

## Prerequisites

- Docker Desktop installed and running
- Docker Hub account (free) — images are pushed to `awilson79/state-park-stays`

## Build and Push

Run this from the project root whenever you want to deploy an update:

```bash
bash deploy.sh
```

This builds the Docker image locally and pushes it to Docker Hub. The Unraid container will not update automatically — you trigger the update manually (see below).

## Unraid Setup (first time)

1. In Unraid, go to **Docker → Add Container**
2. Fill in the form:

| Field | Value |
|-------|-------|
| Name | `state-park-stays` |
| Repository | `awilson79/state-park-stays:latest` |
| Network Type | `bridge` |
| WebUI | `http://[IP]:[PORT:3000]/` |
| Port mapping | Host: `3000` → Container: `3000` (TCP) |
| Volume mapping | Host: `/mnt/user/appdata/state-park-stays/` → Container: `/data` (Read/Write) |
| Environment variable | `DATA_DIR` = `/data` |

3. Click **Apply**. Unraid will pull the image and start the container.
4. Open `http://[your-unraid-ip]:3000` in any browser on your network.

## Deploying Updates

After running `bash deploy.sh`:

1. In Unraid Docker UI, find `state-park-stays`
2. Click the container icon → **Force Update**
3. Unraid pulls the new image and restarts the container
4. Your park data is untouched (it lives in `/mnt/user/appdata/state-park-stays/`, not inside the container)

## Local Testing with Docker Compose

To test the Docker build locally before pushing:

```bash
docker compose up --build
```

Open `http://localhost:3000`. Data is stored in a Docker-managed named volume (`park-data`).

To stop:
```bash
docker compose down
```

To stop and delete the local volume (wipes data):
```bash
docker compose down -v
```

## Migrating Existing Data to Unraid

If you have park data in a local `parks.db` and want to carry it over:

```bash
# Copy your local database to the Unraid appdata folder via SSH
scp parks.db root@[your-unraid-ip]:/mnt/user/appdata/state-park-stays/parks.db
```

Do this before starting the container for the first time, or while the container is stopped.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | app directory | Directory where `parks.db` is stored — set to `/data` in Docker |
| `PORT` | `3000` | Port the server listens on |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (not needed in Docker since frontend is same-origin) |

## How It Works

The Dockerfile uses a two-stage build:

1. **Builder stage** — installs build tools (`python3`, `make`, `g++`), compiles the native `better-sqlite3` module, and runs `npm run build` to produce the Vite frontend bundle in `dist/`
2. **Runtime stage** — copies only the compiled `node_modules` and built `dist/` into a clean image with no build tools, keeping the final image small

In production mode (`NODE_ENV=production`), the Express server serves `dist/` as static files and falls back to `dist/index.html` for any non-API route. All API routes (`/api/*`) are handled by Express as usual.
