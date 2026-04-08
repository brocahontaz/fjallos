# Phase 1 — Foundation

Establish the project skeleton, tooling, auth, both entry points (TTY and GUI), and the core desktop window manager. Everything subsequent phases build on.

---

## Checklist

- [ ] Repo setup: Bun + Hono + Drizzle + TypeScript
- [ ] Tooling: Prettier + Biome + Lefthook configured, `.editorconfig` committed
- [ ] Auth: sessions table, `POST /auth/login` + `POST /auth/logout`, owner + guest middleware
- [ ] TTY boot sequence + login prompt at `/`
- [ ] Interactive shell (post-login) with core read commands
- [ ] `startx` command → CSS View Transition to GUI
- [ ] `/gui` route: short boot animation + graphical login screen (`/gui/login`)
- [ ] Static desktop shell HTML + initial CSS tokens/reset
- [ ] Window Manager JS (drag, resize, open/close, z-index)
- [ ] Desktop layout, taskbar, clock
- [ ] HTMX wired up: open/close windows via server fragments

---

## Subsystem: Boot & Entry Flow

### Route `/` — Terminal path (default)

The page opens as a fullscreen terminal. This is the primary entry point.

```
[boot sequence]
  → scrolling system log (fake hardware init, module loading, FS mount)
  → "System ready."

[TTY login prompt]
  login: _             ← visitor types a username (or "guest")
  password: _          ← owner types password; guest presses Enter / types anything

[shell]
  guest@webdesktop:~$ _    ← interactive shell, full command set
```

**Boot details:**

- Fullscreen `<div class="tty">`, dark terminal aesthetic, no desktop chrome
- Boot log streamed via SSE or typewriter JS effect
- Skip: press `Ctrl+C` or `Escape` during boot → skip straight to login prompt
- Login is a real auth check: `POST /auth/login`; guest login accepts any/blank password and creates a guest session
- On login failure: `Login incorrect.` + re-prompt (rate-limited server-side)
- After successful login: shell prompt appears

**From the shell, the GUI is opt-in:**

```bash
startx          # launches the GUI desktop environment
startx --reset  # launches GUI, clears previous window layout
```

`startx` triggers a CSS View Transition: TTY fades out, GUI desktop fades in.

Post-login MOTD:

```
Logged in as: guest
Type `help` to see available commands. Type `startx` to launch the desktop.
```

### Route `/gui` — GUI path (direct)

1. Short boot animation (CSS-only, ~1s)
2. Graphical login screen: username + password fields in a centred card, desktop wallpaper blurred behind it
3. Guest can click "Continue as guest"
4. On login: View Transition → full desktop environment
5. If already logged in (valid session cookie): skip login screen, go straight to desktop

GUI login screen served at `/gui/login`, redirects to `/gui` on success. Session is shared — a TTY login is recognised at `/gui` and vice versa.

---

## Subsystem: Window Manager

Managed entirely in client-side JS (`window-manager.js`) — pure UI state, no server round-trips.

**Features:**

- Open, close, minimise, maximise windows
- Drag via title bar (Pointer Events API)
- Resize via edge/corner handles
- Z-index stacking with focus management
- Window snap (left/right half, maximise) via drag-to-edge
- Window state serialised to `sessionStorage` for refresh persistence
- CSS `@starting-style` + `transition` for open/close animations
- CSS View Transitions API for minimise/maximise

**DOM model:**

```html
<div class="window" id="win-{id}" data-app="{appName}" style="--x:…; --y:…; --w:…; --h:…;">
  <header class="window__chrome">
    <span class="window__title">…</span>
    <nav class="window__controls">…</nav>
  </header>
  <div class="window__body" hx-get="/apps/{appName}" hx-trigger="load">…</div>
</div>
```

The `window__body` uses HTMX to lazy-load app content on open.

---

## Subsystem: Desktop Shell

- Wallpaper: CSS `background` with user-selectable themes via `data-theme` on `<body>`
- Taskbar: pinned app icons + running window indicators, clock, system tray area
- Right-click context menu on desktop (native `<dialog>` or a custom popover)
- App launcher placeholder (full implementation in Phase 4)

**HTMX wiring:**

- Clicking an app icon sends `hx-post="/windows/open?app=terminal"` → server returns window HTML fragment → swapped into `#desktop` via `hx-swap="beforeend"`
- Taskbar indicators auto-update via HTMX SSE or polling
