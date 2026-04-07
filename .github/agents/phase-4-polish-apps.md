# Phase 4 — Polish & Apps

Add the portfolio-facing About app, Mini Browser, theme system, animations, app launcher, and boot sequence polish. This phase makes the project presentable as a portfolio site.

---

## Checklist

- [ ] About/Portfolio app (intro, skills, projects, contact)
- [ ] Terminal portfolio commands: `whoami`, `projects`, `cv`, `contact`
- [ ] Mini Browser (proxied `<iframe>`)
- [ ] Theme switcher (multiple wallpapers + colour schemes)
- [ ] Window snap + View Transitions animations
- [ ] App launcher / spotlight search
- [ ] Scroll-driven animations on About app
- [ ] `@starting-style` enter transitions on HTMX-swapped fragments
- [ ] Boot sequence polish + `Escape`/`Ctrl+C` skip-to-login shortcut

---

## Subsystem: About / Portfolio App

The primary portfolio surface — what visitors and recruiters actually read.

- Server-rendered JSX with sections: intro, skills, selected projects, contact
- Terminal-accessible:
  - `whoami` → compact personal summary + role
  - `projects` → plain-text list of projects with descriptions
  - `cv` → prints CV summary in terminal; in GUI mode also opens the About window
  - `contact` → prints contact info / links
- CSS scroll-driven animations for content section reveals
- Project cards link out to GitHub repos and live demos
- Designed to look polished as a windowed app _and_ when maximised fullscreen
- Opens automatically after `startx` or on `/gui` desktop load (can be dismissed)

---

## Subsystem: Mini Browser

- An `<iframe>` sandboxed app that proxies URLs through the server to avoid mixed-content issues
- Address bar: `hx-get="/apps/browser/proxy?url=…"` returns a safe iframe `src` or pre-fetched inline content
- Proxied URLs validated against a server-side allowlist (no arbitrary SSRF)
- Back/forward history managed client-side (array of visited URLs in JS)
- `iframe` attributes: `sandbox="allow-scripts allow-same-origin"`, `referrerpolicy="no-referrer"`

---

## Theme System

- Multiple built-in themes: e.g. `dark` (default), `light`, `gruvbox`, `nord`, `dracula`
- Theme stored in `window_layouts` / user preferences for owners; session-only for guests
- `theme <name>` terminal command applies the theme immediately
- Theme switcher in the desktop system tray
- Implemented via `data-theme` attribute on `<html>`, with full token overrides per theme in `tokens.css`
- TTY also respects the theme (ANSI colour classes remapped via CSS custom properties)

---

## App Launcher / Spotlight Search

- Triggered by keyboard shortcut (e.g. `Cmd/Ctrl+Space`) or clicking the launcher icon in taskbar
- Rendered as a `<dialog>` overlay
- Search input: `hx-get="/launcher/search?q=…" hx-trigger="input delay:200ms"` returns a fragment of matching app tiles
- Keyboard navigable (arrow keys + Enter to open)
- Opens a new window for the selected app via the same `hx-post="/windows/open?app=…"` mechanism

---

## Animations & Transitions

- **Window open:** `@starting-style` + `opacity`/`scale` transition on the `.window` element
- **Window close:** reverse transition triggered by removing the element after the animation ends
- **Minimise/maximise:** CSS View Transitions API — snapshot before, animate to taskbar icon or fullscreen
- **`startx` transition:** View Transition from TTY to GUI desktop (cross-fade or slide)
- **About app scroll reveals:** `animation-timeline: scroll()` with `@keyframes` entry animations
- **Boot log:** typewriter effect via JS (`requestAnimationFrame`) or streamed SSE
