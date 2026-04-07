# Personal Web Desktop — Project Plan

## Vision

A browser-based personal web desktop that mimics a modern OS UX — doubling as a portfolio site. The experience mirrors a real OS boot: the page opens as a fullscreen terminal, runs a boot sequence, then drops the visitor into a TTY-style login prompt. After logging in (or continuing as guest), they land in the shell. The GUI desktop is opt-in — launched via `startx` in the terminal, or directly via `/gui` in the browser.

Built with cutting-edge web standards: HTMX for server-driven interactions, modern CSS (layers, container queries, custom properties, view transitions), and clean vanilla JavaScript where needed. No frontend framework. No build step.

**Two entry points:**

- `/` — Terminal-first: boot → TTY login → shell → (optionally) `startx` to launch GUI
- `/gui` — GUI-first: boot animation → graphical login screen → desktop environment

---

## Documents

| Document                                           | Contents                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [guidelines.md](guidelines.md)                     | Tech stack, architecture, CSS patterns, HTMX patterns, auth, data model, security, code standards |
| [phase-1-foundation.md](phase-1-foundation.md)     | Repo setup, auth, TTY boot, login, shell, `startx`, GUI route, window manager, desktop shell      |
| [phase-2-terminal.md](phase-2-terminal.md)         | Full shell interpreter, SSE streaming, terminal history, ANSI output                              |
| [phase-3-files-editor.md](phase-3-files-editor.md) | Virtual filesystem, file explorer, text editor                                                    |
| [phase-4-polish-apps.md](phase-4-polish-apps.md)   | About/Portfolio app, Mini Browser, themes, animations, app launcher                               |
| [phase-5-deployment.md](phase-5-deployment.md)     | Docker, hosting, persistence, domain, HTTPS, owner setup                                          |
| [phase-6-mobile.md](phase-6-mobile.md)             | Mobile detection, portfolio fallback page, progressive enhancement                                |

---

## Phases at a Glance

| Phase | Name                        | Status      |
| ----- | --------------------------- | ----------- |
| 1     | Foundation                  | not started |
| 2     | Terminal                    | not started |
| 3     | File Explorer & Text Editor | not started |
| 4     | Polish & Apps               | not started |
| 5     | Deployment                  | not started |
| 6     | Mobile (Future)             | not started |

---

## Open Questions / Decisions

1. ~~**Auth**~~ — **Decided:** owner + guest roles; cookie sessions; bcrypt passwords; guest is implicit.
2. ~~**Mobile**~~ — **Decided:** desktop-first now; Phase 6 adds a mobile fallback portfolio page.
3. **Real-time** — Use HTMX SSE or WebSockets for collaborative features later?
4. **Font** — System font stack or a specific monospace/sans pair? (Leaning: `GeistMono` for terminal, system-ui for UI)
5. **Offline** — Service Worker + `cache-first` for shell assets?
