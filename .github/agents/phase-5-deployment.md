# Phase 5 — Deployment

Package and deploy the application with persistent storage, HTTPS, and a first-run owner setup flow.

---

## Checklist

- [ ] Dockerise the application (`Dockerfile` + `.dockerignore`)
- [ ] Deploy to Fly.io or Railway (choose based on SQLite volume support)
- [ ] SQLite persistence via mounted volume
- [ ] Custom domain + HTTPS (managed by host or Caddy sidecar)
- [ ] Owner credentials set via env vars / first-run setup script
- [ ] Health check endpoint (`GET /health`)
- [ ] Production environment config (env var validation on startup)

---

## Notes

**SQLite + volume mount:**

- The `.db` file lives at a path set by `DATABASE_URL` env var
- In Docker, mount a persistent volume to that path so the DB survives container restarts
- Fly.io: use a Fly Volume; Railway: use a Railway Volume or external SQLite service

**Owner setup:**

- On first boot with no `sessions` rows: check for `OWNER_USERNAME` + `OWNER_PASSWORD_HASH` env vars
- If present, they are used directly by the auth handler (no DB row needed for the owner account — stateless credential check against env)
- Alternatively, provide a `bun run setup` script that prompts for a password and writes the bcrypt hash to `.env`

**Environment variables:**

| Variable              | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `DATABASE_URL`        | Path to SQLite file                                   |
| `OWNER_USERNAME`      | Owner login username                                  |
| `OWNER_PASSWORD_HASH` | bcrypt hash of owner password                         |
| `SESSION_SECRET`      | Secret for signing session cookies                    |
| `SESSION_TTL_DAYS`    | Session expiry in days (default: 7)                   |
| `PORT`                | Server port (default: 3000)                           |
| `PROXY_ALLOWLIST`     | Comma-separated domains allowed in Mini Browser proxy |
