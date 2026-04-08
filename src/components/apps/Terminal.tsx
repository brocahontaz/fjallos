import type { FC } from 'hono/jsx'

interface TerminalProps {
  role: 'owner' | 'guest'
  username: string
  history?: Array<{ command: string; output: string }>
}

export const Terminal: FC<TerminalProps> = ({ role, username, history = [] }) => {
  return (
    <div class="terminal" data-role={role} data-username={username}>
      <div class="terminal__output" id="terminal-output" aria-live="polite" role="log">
        <div class="terminal__motd">
          <p>Logged in as: {username}</p>
          <p>Type `help` to see available commands. Type `startx` to launch the desktop.</p>
        </div>
        {history.map((entry, i) => (
          <div class="terminal__history-entry" key={`${entry.command}-${i}`}>
            <div class="terminal__prompt-line">
              <span class="terminal__prompt-char">{username}@webdesktop:~$</span>
              <span class="terminal__command">{entry.command}</span>
            </div>
            {entry.output && <pre class="terminal__output-text">{entry.output}</pre>}
          </div>
        ))}
      </div>
      <div class="terminal__input-line">
        <span class="terminal__prompt-char" aria-hidden="true">
          {username}@webdesktop:~$
        </span>
        <input
          class="terminal__input"
          type="text"
          id="terminal-input"
          aria-label="Terminal input"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck={false}
          autofocus
        />
      </div>
    </div>
  )
}
