import type { FC } from 'hono/jsx'

interface TerminalProps {
  role: 'owner' | 'guest'
  username: string
}

export const Terminal: FC<TerminalProps> = ({ role, username }) => {
  return (
    <div class="terminal" data-role={role} data-username={username} data-mode="gui">
      <div class="terminal__output" aria-live="polite" role="log">
        <div class="terminal__motd">
          <p>Logged in as: {username}</p>
          <p>Type `help` to see available commands. Type `exit` to close.</p>
        </div>
        <div class="terminal__input-line">
          <span class="terminal__prompt-char" aria-hidden="true">
            {username}@webdesktop:~$
          </span>
          <input
            class="terminal__input"
            type="text"
            aria-label="Terminal input"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck={false}
            autofocus
          />
        </div>
      </div>
    </div>
  )
}
