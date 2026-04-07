# Phase 3 — File Explorer & Text Editor

Implement the virtual filesystem backed by SQLite, the graphical file explorer app, and the text editor with auto-save.

---

## Checklist

- [ ] Virtual FS schema + API routes
- [ ] File Explorer UI with directory navigation
- [ ] Breadcrumb navigation
- [ ] Drag-and-drop between folder windows
- [ ] Text Editor with syntax highlighting
- [ ] Text Editor auto-save
- [ ] File create/open integration between Explorer and Editor

---

## Subsystem: File Explorer

- Virtual filesystem stored in SQLite (`fs_nodes` table — see [guidelines.md](guidelines.md))
- Directory listing: `hx-get="/apps/files?path=…"` returns a `<ul>` fragment swapped in-place
- Double-click file → opens it in a Text Editor window
- Double-click directory → navigates into it (HTMX swap of the listing)
- Drag-and-drop between open folder windows (JS drag events + `hx-post` to move node)
- Breadcrumb navigation rendered as a `<nav>` fragment, swapped via OOB on each navigation
- New file / new folder via context menu or toolbar buttons
- Delete via context menu (owner only; guest sees the option greyed out)

**API routes:**

| Method   | Route                | Description                        |
| -------- | -------------------- | ---------------------------------- |
| `GET`    | `/apps/files?path=…` | List directory contents (fragment) |
| `POST`   | `/apps/files/mkdir`  | Create directory                   |
| `POST`   | `/apps/files/touch`  | Create empty file                  |
| `POST`   | `/apps/files/move`   | Move/rename node                   |
| `DELETE` | `/apps/files/:id`    | Delete node (owner only)           |

---

## Subsystem: Text Editor

- `<textarea>` with syntax highlighting via highlight.js (loaded lazily on first open)
- Auto-save: `hx-trigger="input delay:800ms"` posts content to `/apps/editor/save/:id`
- Save indicator: `HX-Trigger: file-saved` response header updates a status badge OOB
- File open: triggered from File Explorer double-click — `hx-get="/apps/editor/open/:id"` loads content into editor window
- New file: creates an `fs_nodes` entry first, then opens the editor
- Read-only mode for guest users (editor rendered without `<textarea>`, uses `<pre>` instead)

**API routes:**

| Method | Route                   | Description                     |
| ------ | ----------------------- | ------------------------------- |
| `GET`  | `/apps/editor/open/:id` | Load file content into editor   |
| `POST` | `/apps/editor/save/:id` | Save file content (owner only)  |
| `POST` | `/apps/editor/new`      | Create new file and open editor |
