# fjallos

A browser-based personal web desktop that doubles as a portfolio site. The experience mirrors a real OS boot: the page opens as a fullscreen terminal, runs a boot sequence, then drops the visitor into a TTY-style login prompt. The GUI desktop is opt-in — launched via `startx` in the terminal, or directly via `/gui`.

## Entry Points

- **`/`** — Terminal-first: boot sequence → TTY login → shell → optionally `startx` to launch the GUI desktop
- **`/gui`** — GUI-first: boot animation → graphical login screen → full desktop environment

## Tech Stack

| Concern       | Choice                                           |
| ------------- | ------------------------------------------------ |
| Runtime       | Bun                                              |
| Framework     | Hono + JSX (server-side)                         |
| Interactivity | HTMX 2.x                                         |
| Styling       | Vanilla CSS (layers, nesting, custom properties) |
| Scripting     | Vanilla ES2024+ modules                          |
| Database      | SQLite via Drizzle ORM                           |
| Formatting    | Prettier                                         |
| Linting       | Biome                                            |
| Git hooks     | Lefthook                                         |

## Getting Started

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env and set OWNER_USERNAME and OWNER_PASSWORD_HASH

# Run database migrations
bun run db:migrate

# Start development server
bun run dev
```

The app runs at `http://localhost:3000`.

## Development

```bash
bun run dev        # Start with hot-reload
bun run lint       # Lint with Biome
bun run format     # Format with Prettier
bun run check      # Biome check
bun run db:migrate # Run DB migrations
```

## Project Structure

```
├── public/          # Static assets (CSS, JS)
│   ├── css/         # Layered CSS architecture
│   └── js/          # window-manager.js, terminal.js
├── src/
│   ├── server.tsx   # Hono app entry + routes
│   ├── auth/        # Session auth middleware + routes
│   ├── apps/        # HTMX app route handlers
│   ├── components/  # Server-rendered JSX components
│   ├── db/          # Drizzle schema + client
│   └── lib/         # Shell interpreter + virtual FS
└── .github/agents/  # Phase planning documents
```

## Phases

| Phase | Name                        | Status      |
| ----- | --------------------------- | ----------- |
| 1     | Foundation                  | ✅ Complete |
| 2     | Terminal                    | Not started |
| 3     | File Explorer & Text Editor | Not started |
| 4     | Polish & Apps               | Not started |
| 5     | Deployment                  | Not started |
| 6     | Mobile                      | Not started |
