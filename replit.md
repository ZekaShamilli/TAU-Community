# TAU KAYS - Club & Activity Management System

A role-based web application for managing student clubs at TAU university.

## Architecture

- **Monorepo** with npm workspaces (`packages/*`)
- **Frontend**: React + Vite + TypeScript (`packages/frontend/`)
- **Backend API**: Express.js serverless-style handlers (`api/`)
- **Server**: Express.js (`server.js`) — serves both the API and the built frontend SPA
- **Database**: PostgreSQL (Supabase) via `DATABASE_URL`

## Running the App

The app runs as a single unified server on port 5000:

```bash
# Build the frontend first
npm run build:frontend

# Then start the server
npm start
```

The workflow "Start application" runs `node server.js` on port 5000.

## Development

For dev mode, only the Vite frontend dev server runs (proxying API requests to port 5000):

```bash
npm run dev
```

This runs `vite` in `packages/frontend` on port 5000 with `allowedHosts: true`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase) |
| `PORT` | No | Server port (defaults to 5000) |

## Key Files

- `server.js` — Main Express server (serves API + static frontend)
- `api/index.js` — API route handler (all `/api/*` routes)
- `api/check-application.js` — Application check endpoint
- `api/email-service.js` — Email service helper
- `packages/frontend/` — React frontend (Vite)
- `packages/frontend/dist/` — Built frontend (generated, not committed)

## Migration Notes (Vercel → Replit)

- `server.js` port changed from 3000 → 5000
- `packages/frontend/vite.config.ts` port changed from 3001 → 5000, `allowedHosts: true`
- `packages/frontend/postcss.config.js` converted from ESM (`export default`) to CJS (`module.exports`)
- Root `dev` script simplified to run only the Vite frontend server
