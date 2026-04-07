# Phase 2 — Terminal

Build out the full shell interpreter, streaming output, persistent history, and ANSI colour rendering. The terminal works both as the primary TTY interface and as a GUI app window.

---

## Checklist

- [ ] Shell interpreter with full command set
- [ ] SSE streaming output via `hx-ext="sse"`
- [ ] Terminal history persisted in SQLite
- [ ] ANSI colour output (mapped to CSS classes)
- [ ] Context-aware command set (TTY mode vs. GUI window mode)

---

## Subsystem: Terminal / Shell

A sandboxed, in-browser terminal. **Not** a real shell — a custom interpreter with a defined command set. Runs server-side; the client is a thin display layer.

### Architecture

- Client: `terminal.js` renders a `<div role="term">` with a scrollback buffer and an input line
- Each command submission: `hx-post="/apps/terminal/run"` with the command string
- Server (`src/lib/shell.ts`): parses command, executes against virtual FS or data layer, streams response via SSE (`hx-ext="sse"`)
- Output rendered as HTML fragments (ANSI colour codes mapped to `<span class="ansi-…">`)

### Supported Commands

```
help              — list available commands
clear             — clear terminal output
echo <text>       — print text
ls [path]         — list directory contents
cd <path>         — change directory
pwd               — print working directory
cat <file>        — print file contents
mkdir <dir>       — create directory
touch <file>      — create empty file
rm <path>         — remove file or directory
whoami            — personal info card + current role
projects          — list portfolio projects
cv                — print CV summary
contact           — print contact info
theme <name>      — change TTY/desktop colour theme
fetch <url>       — server-proxied HTTP fetch (sandboxed, allowlisted)
login             — re-run login prompt (switch user)
logout            — end session, return to login prompt
exit              — return to login prompt
startx            — launch the GUI desktop environment  [TTY only]
startx --reset    — launch GUI, reset window layout      [TTY only]
```

**Context awareness:** `startx` is TTY-only. When the terminal runs inside the GUI as an app window, `startx` is not available and `exit` closes the terminal window instead of logging out.

### Streaming Output

Long-running or multi-line responses stream via the HTMX SSE extension:

- Server opens an SSE connection and sends HTML fragments line by line
- Client appends each fragment to the scrollback buffer in real time
- Connection closes when the command completes; an `HX-Trigger: command-done` response header fires a client-side event to re-enable the input

### Terminal History

- Every command + output + exit code written to `terminal_history` in SQLite (owner sessions only; guest history is session-memory only, not persisted)
- Up/Down arrow keys cycle through history (client-side, loaded from `GET /apps/terminal/history`)

### ANSI Colours

ANSI escape sequences from command output are parsed server-side and converted to semantic CSS classes:

```
\e[32m  →  <span class="ansi-green">
\e[1m   →  <span class="ansi-bold">
\e[0m   →  </span> (reset)
```

Colour values defined as CSS custom properties in `tokens.css` so they respect the active theme.
