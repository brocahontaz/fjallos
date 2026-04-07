# Guidelines & Standards

Reference document for tech stack decisions, architecture, coding standards, and cross-cutting concerns. Applies to all phases.

---

## Tech Stack

| Concern       | Choice                                                        | Rationale                                                    |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| Markup        | Semantic HTML5                                                | Baseline, accessible                                         |
| Interactivity | HTMX 2.x                                                      | Declarative server-driven UI, progressive enhancement        |
| Styling       | Vanilla CSS (layers, nesting, `@property`, container queries) | No preprocessor needed with modern CSS                       |
| Scripting     | Vanilla ES2024+ modules                                       | Only where HTMX falls short (drag, resize, focus management) |
| Backend       | Bun + Hono                                                    | Lightweight, ultra-fast, first-class HTMX target             |
| Templating    | JSX via Hono's JSX renderer (server-side only)                | Clean component model, no client runtime                     |
| Persistence   | SQLite via Drizzle ORM                                        | Simple, file-based, no infra                                 |
| Dev tooling   | Bun (runtime + bundler)                                       | Instant startup, native TypeScript                           |
| Formatting    | Prettier                                                      | Consistent code style, auto-enforced                         |
| Linting       | Biome                                                         | Fast, opinionated linter + formatter for TS/JS               |
| Git hooks     | Lefthook                                                      | Pre-commit: Prettier + Biome + type-check                    |

---

## Code Quality & Standards

### Formatting — Prettier

- Single source of truth for code style; config committed at `.prettierrc`
- Enforced on all `.ts`, `.tsx`, `.js`, `.css`, `.html`, `.json`, `.md` files
- Config:
  ```json
  {
    "semi": false,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "plugins": ["prettier-plugin-organize-imports"]
  }
  ```

### Linting — Biome

- Replaces ESLint for TS/JS linting; fast, zero-config to start
- `biome check --apply` run on pre-commit
- Extends recommended ruleset; project-specific overrides in `biome.json`

### TypeScript

- `strict: true` in `tsconfig.json` — no escape hatches
- No `any`; use `unknown` + type guards at boundaries
- All server route handlers explicitly typed (request + response)

### Git Hooks — Lefthook

- `lefthook.yml` committed to repo
- `pre-commit`: run Prettier check + Biome lint + `tsc --noEmit`
- `commit-msg`: enforce Conventional Commits format (`feat:`, `fix:`, `chore:`, etc.)

### Conventions

- **File naming:** `kebab-case` for all files and directories
- **CSS class naming:** BEM-lite (`block__element--modifier`)
- **Component naming:** PascalCase for JSX components
- **Commits:** Conventional Commits — enables auto-changelog generation
- **Imports:** absolute imports from `src/` root via `tsconfig` path aliases

---

## Architecture

```
/
├── public/               # Static assets served directly
│   ├── css/
│   │   ├── reset.css
│   │   ├── tokens.css        # Design tokens via CSS custom properties
│   │   ├── desktop.css       # Desktop shell layout
│   │   ├── window.css        # Window chrome styles
│   │   └── apps/             # Per-app stylesheets
│   └── js/
│       ├── window-manager.js # Drag, resize, z-index, focus ring
│       ├── terminal.js       # Terminal emulator logic
│       └── htmx-ext/         # Custom HTMX extensions if needed
├── src/
│   ├── server.ts             # Hono app entry, routes
│   ├── db/
│   │   ├── schema.ts
│   │   └── client.ts
│   ├── components/           # Server-rendered JSX components
│   │   ├── Desktop.tsx
│   │   ├── Taskbar.tsx
│   │   ├── Window.tsx        # Reusable window chrome
│   │   └── apps/
│   │       ├── Terminal.tsx
│   │       ├── FileExplorer.tsx
│   │       ├── TextEditor.tsx
│   │       ├── Browser.tsx
│   │       └── About.tsx
│   ├── apps/                 # App route handlers (HTMX partial responses)
│   │   ├── terminal.ts
│   │   ├── files.ts
│   │   ├── editor.ts
│   │   └── browser.ts
│   ├── auth/
│   │   ├── middleware.ts      # Session validation, role guard
│   │   └── routes.ts         # Login / logout / session endpoints
│   └── lib/
│       ├── shell.ts          # Sandboxed shell command interpreter
│       └── fs.ts             # Virtual filesystem abstraction
└── index.html                # Shell HTML — loaded once, everything else is HTMX
```

---

## CSS Architecture

```css
/* Layer order (lowest → highest specificity) */
@layer reset, tokens, base, layout, components, utilities, themes;
```

**Key patterns:**

- Design tokens via `@property` registered custom properties (typed, animatable)
- Window geometry via CSS custom properties (`--x`, `--y`, `--w`, `--h`) set by JS
- Container queries for responsive app content independent of viewport
- `color-scheme: light dark` with per-theme overrides via `[data-theme]`
- CSS nesting for component styles (no preprocessor)
- `@starting-style` for enter animations on HTMX-swapped fragments
- Logical properties throughout (`inline-size`, `block-size`, `inset-*`)

---

## HTMX Patterns

| Pattern                         | Usage                                                             |
| ------------------------------- | ----------------------------------------------------------------- |
| `hx-get` / `hx-post`            | Load app content, submit commands                                 |
| `hx-swap="beforeend"`           | Append new windows to desktop                                     |
| `hx-target`                     | Scope swaps to correct window body or taskbar                     |
| `hx-trigger="load"`             | Lazy-load app on window open                                      |
| `hx-push-url`                   | Deep-linkable window states                                       |
| `hx-ext="sse"`                  | Stream terminal output                                            |
| `hx-boost`                      | Turbo-navigate within app pages                                   |
| Response headers (`HX-Trigger`) | Server-side events → client-side reactions (e.g., update taskbar) |
| OOB swaps (`hx-swap-oob`)       | Update taskbar/dock from app responses                            |

---

## Auth

### Roles

| Role      | Capabilities                                                                    |
| --------- | ------------------------------------------------------------------------------- |
| **owner** | Full access: file editor, terminal write ops, theme persistence, admin commands |
| **guest** | Read-only: browse files, run read-only terminal commands, view About/Portfolio  |

### Implementation

- Cookie-based sessions (signed `HttpOnly`, `SameSite=Strict`)
- Auth endpoints: `POST /auth/login`, `POST /auth/logout`
- Terminal path (`/`): login via TTY prompt — username + password submitted to `/auth/login`; guest accepts blank/any password
- GUI path (`/gui`): login via graphical form at `/gui/login`; "Continue as guest" button available
- Single owner account — credentials set via env vars at deploy time (no registration flow)
- Hono middleware guards write routes server-side; guests cannot escalate via client manipulation
- `logout` / `exit` terminal commands end session and return to login prompt
- Session expiry: configurable via env var (default 7 days, sliding)

### Guest UX

- Guest login at TTY: type "guest" (or blank) at the login prompt — no real password required
- Guest login at GUI: click "Continue as guest"
- Guest capabilities are enforced server-side; write-gated actions surface: `Permission denied. Run 'login' to authenticate.`
- Desktop layout and theme are not persisted for guests (session-only defaults)

---

## Data Model (SQLite)

```sql
-- Auth
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,       -- signed session ID
  role       TEXT NOT NULL CHECK(role IN ('owner','guest')),
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Virtual filesystem
CREATE TABLE fs_nodes (
  id         INTEGER PRIMARY KEY,
  parent_id  INTEGER REFERENCES fs_nodes(id),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK(type IN ('file','dir')),
  content    TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Desktop layout persistence
CREATE TABLE window_layouts (
  id        INTEGER PRIMARY KEY,
  app       TEXT NOT NULL,
  x         INTEGER, y INTEGER,
  width     INTEGER, height INTEGER,
  z_index   INTEGER,
  minimised INTEGER DEFAULT 0
);

-- Terminal history
CREATE TABLE terminal_history (
  id        INTEGER PRIMARY KEY,
  command   TEXT NOT NULL,
  output    TEXT,
  exit_code INTEGER,
  ran_at    TEXT DEFAULT (datetime('now'))
);
```

---

## Security

- Terminal commands run in a sandboxed interpreter — no `exec`, no real FS access beyond SQLite virtual FS
- Mini Browser URLs proxied server-side with allowlist; no arbitrary SSRF
- HTMX requests validated with CSRF token via custom request header (`HX-CSRF-Token`)
- `Content-Security-Policy` header set; no `unsafe-inline` scripts
- `iframe` sandbox attribute on Mini Browser: `allow-scripts allow-same-origin` only
- All DB queries parameterised (Drizzle ORM)
- Passwords hashed with bcrypt (cost factor ≥ 12)
- Sessions stored server-side; session ID in cookie only (no sensitive data client-side)
- Rate-limit `/auth/login` endpoint (e.g. 5 attempts / 15 min per IP)
- Write routes guarded by server-side role check — guest cannot escalate via client manipulation
