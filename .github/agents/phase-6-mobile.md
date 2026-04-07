# Phase 6 — Mobile (Future)

Add mobile support via a dedicated portfolio view. No windowing on mobile — the same server-rendered content is surfaced as a clean, scroll-driven portfolio page.

---

## Checklist

- [ ] Detect touch/mobile viewport on load → serve mobile-optimised response
- [ ] Mobile portfolio page using shared server components (no window manager)
- [ ] Shared About/Portfolio content between desktop and mobile views
- [ ] Progressive enhancement: tablet gets a simplified single-window layout
- [ ] Touch-friendly navigation and typography

---

## Approach

**Detection:** Server-side via `User-Agent` header (coarse detection for initial render) combined with a client-side `matchMedia` check for fine-grained adaptation. On mobile, the server serves the `/mobile` route or redirects from `/gui`.

**Mobile page (`/mobile`):**

- Clean, scroll-based portfolio layout — no desktop chrome, no window manager
- Sections map directly to the About app content: intro, skills, projects, contact
- Same JSX components reused from `src/components/apps/About.tsx` — no content duplication
- TTY entry (`/`) on mobile: simplified boot sequence → login prompt → shell only (no `startx`)

**Tablet (`/gui` on touch devices):**

- Single maximised window at a time (no overlapping windows)
- Swipe left/right to switch between open apps
- Window chrome simplified: close button only, no drag/resize handles

**Shared components:**

- `<AboutContent />` JSX component used by both `/mobile` and the GUI About app window
- CSS container queries handle layout differences — the same markup looks right in both contexts
