/**
 * GUI Terminal — handles interactive terminal windows in the desktop environment.
 * Initialised for each .terminal element loaded via HTMX.
 */

/** Read SSE events from a fetch Response and return the final `done` payload. */
async function readStream(response, onHtml) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let donePayload = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))
        if (data.html) onHtml(data.html)
        if (data.done) donePayload = data
      } catch {
        // ignore malformed event
      }
    }
  }

  return donePayload
}

function initTerminal(term) {
  term.dataset.initialized = 'true'

  const outputEl = term.querySelector('.terminal__output')
  const inputLineEl = term.querySelector('.terminal__input-line')
  const promptEl = inputLineEl?.querySelector('.terminal__prompt-char')
  const inputEl = term.querySelector('.terminal__input')

  if (!outputEl || !inputEl) return

  const username = term.dataset.username ?? 'guest'
  let cwd = '~'
  let cmdHistory = []
  let histIdx = -1

  function getPrompt() {
    return `${username}@webdesktop:${cwd}$`
  }

  function updatePrompt() {
    if (promptEl) promptEl.textContent = `${getPrompt()} `
  }

  function appendHtml(html) {
    const pre = document.createElement('pre')
    pre.className = 'terminal__output-text'
    pre.innerHTML = html
    outputEl.appendChild(pre)
    outputEl.scrollTop = outputEl.scrollHeight
  }

  function appendEntry(cmd, htmlOutput) {
    const entry = document.createElement('div')
    entry.className = 'terminal__history-entry'

    const promptLine = document.createElement('div')
    promptLine.className = 'terminal__prompt-line'

    const p = document.createElement('span')
    p.className = 'terminal__prompt-char'
    p.textContent = `${getPrompt()} `

    const c = document.createElement('span')
    c.className = 'terminal__command'
    c.textContent = cmd

    promptLine.appendChild(p)
    promptLine.appendChild(c)
    entry.appendChild(promptLine)

    if (htmlOutput) {
      const pre = document.createElement('pre')
      pre.className = 'terminal__output-text'
      pre.innerHTML = htmlOutput
      entry.appendChild(pre)
    }

    outputEl.insertBefore(entry, inputLineEl)
    outputEl.scrollTop = outputEl.scrollHeight
  }

  async function handleEnter() {
    const cmd = inputEl.value.trim()
    inputEl.value = ''
    histIdx = -1

    if (cmd) {
      cmdHistory.unshift(cmd)
      if (cmdHistory.length > 100) cmdHistory.pop()
    }

    const csrf = document.getElementById('desktop')?.dataset.csrf ?? ''

    // Disable input while running
    inputEl.disabled = true

    let accumulatedHtml = ''

    try {
      const res = await fetch('/apps/terminal/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: JSON.stringify({ command: cmd, cwd, mode: 'gui' }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const donePayload = await readStream(res, (html) => {
        accumulatedHtml += html
      })

      appendEntry(cmd, accumulatedHtml)

      if (donePayload) {
        if (donePayload.newCwd) {
          cwd = donePayload.newCwd
          updatePrompt()
        }

        const action = donePayload.action
        if (action === 'clear') {
          while (outputEl.firstChild !== inputLineEl) {
            outputEl.removeChild(outputEl.firstChild)
          }
        } else if (action === 'close-window') {
          const win = term.closest('.window')
          if (win) win.remove()
        } else if (action === 'theme' && donePayload.themeValue) {
          document.getElementById('tty')?.setAttribute('data-theme', donePayload.themeValue)
          document.getElementById('desktop')?.setAttribute('data-theme', donePayload.themeValue)
        }
      }
    } catch {
      appendEntry(cmd, '<span class="ansi-red">Error: could not reach server</span>')
    } finally {
      inputEl.disabled = false
      inputEl.focus()
    }
  }

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleEnter()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (histIdx < cmdHistory.length - 1) {
        histIdx++
        inputEl.value = cmdHistory[histIdx] ?? ''
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx > 0) {
        histIdx--
        inputEl.value = cmdHistory[histIdx] ?? ''
      } else {
        histIdx = -1
        inputEl.value = ''
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      while (outputEl.firstChild !== inputLineEl) {
        outputEl.removeChild(outputEl.firstChild)
      }
    }
  })

  // Focus input when clicking anywhere in the terminal
  term.addEventListener('click', () => inputEl.focus())

  // Set initial prompt text and scroll to show input
  updatePrompt()
  outputEl.scrollTop = outputEl.scrollHeight
  inputEl.focus()
}

// Initialise any terminal already in the DOM on script load
document.querySelectorAll('.terminal:not([data-initialized])').forEach(initTerminal)

// Initialise terminals loaded later via HTMX
document.body.addEventListener('htmx:afterSettle', (e) => {
  const elt = e.detail?.elt ?? e.target
  if (!elt) return
  const terminal = elt.matches?.('.terminal') ? elt : elt.querySelector?.('.terminal')
  if (terminal && !terminal.dataset.initialized) {
    initTerminal(terminal)
  }
})
