import type { FC } from 'hono/jsx'

interface TaskbarProps {
  role: 'owner' | 'guest'
}

export const Taskbar: FC<TaskbarProps> = ({ role }) => {
  return (
    <footer class="taskbar" id="taskbar" role="toolbar" aria-label="Taskbar">
      <div class="taskbar__start">
        <button type="button" class="taskbar__launcher" aria-label="App launcher">
          <span class="taskbar__launcher-icon" aria-hidden="true">⊞</span>
        </button>
      </div>
      <ul class="taskbar__apps" id="taskbar-apps" aria-label="Running applications">
        <li>
          <button
            type="button"
            class="taskbar__app-btn"
            aria-label="Open Terminal"
            hx-post="/windows/open"
            hx-vals='{"app":"terminal"}'
            hx-target="#windows-container"
            hx-swap="beforeend"
          >
            <span aria-hidden="true">⬛</span>
            Terminal
          </button>
        </li>
      </ul>
      <div class="taskbar__tray">
        <span class="taskbar__role" aria-label={`Logged in as ${role}`}>{role}</span>
        <button type="button" class="taskbar__tty-btn" aria-label="Switch to TTY" onclick="window.location.href='/'">
          TTY
        </button>
        <time class="taskbar__clock" id="taskbar-clock" aria-live="polite" datetime="">
          --:--
        </time>
      </div>
    </footer>
  )
}
