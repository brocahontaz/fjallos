/**
 * TTY Terminal Client
 * Handles boot sequence, login, and shell command execution.
 */

const tty = document.getElementById('tty')
const output = document.getElementById('tty-output')
const inputLine = document.getElementById('tty-input-line')
const prompt = document.getElementById('tty-prompt')
const input = document.getElementById('tty-input')

let state = 'booting' // booting | login-username | login-password | shell
let username = ''
let password = ''
let csrfToken = ''
let commandHistory = []
let historyIndex = -1

const BOOT_LINES = [
  { text: 'fjallos v0.1.0 -- personal web desktop', cls: 'tty__boot-line--info', delay: 0 },
  { text: 'Copyright (c) 2024. All rights reserved.', cls: 'tty__boot-line--dim', delay: 60 },
  { text: '', cls: '', delay: 80 },
  { text: '[    0.000] Initializing kernel...', cls: 'tty__boot-line--dim', delay: 120 },
  { text: '[    0.042] Loading drivers...', cls: 'tty__boot-line--dim', delay: 180 },
  {
    text: '[    0.118] Mounting filesystem...           [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 280,
  },
  {
    text: '[    0.204] Starting network services...     [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 400,
  },
  {
    text: '[    0.331] Starting database...             [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 520,
  },
  {
    text: '[    0.412] Starting web server...           [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 640,
  },
  { text: '', cls: '', delay: 720 },
  { text: 'fjallos login:', cls: 'tty__boot-line--info', delay: 800 },
]

function writeLine(text, cls = '') {
  const line = document.createElement('span')
  line.className = `tty__boot-line${cls ? ' ' + cls : ''}`
  line.textContent = text
  output.insertBefore(line, inputLine)
  output.scrollTop = output.scrollHeight
}

function writeShellLine(promptText, cmd, outputText) {
  const entry = document.createElement('div')

  const promptLine = document.createElement('div')
  promptLine.style.display = 'flex'
  promptLine.style.gap = '0.5rem'

  const p = document.createElement('span')
  p.className = 'tty__shell-prompt'
  p.textContent = promptText

  const c = document.createElement('span')
  c.className = 'tty__shell-command'
  c.textContent = cmd

  promptLine.appendChild(p)
  promptLine.appendChild(c)
  entry.appendChild(promptLine)

  if (outputText) {
    const o = document.createElement('pre')
    o.className = 'tty__shell-output'
    o.textContent = outputText
    entry.appendChild(o)
  }

  output.insertBefore(entry, inputLine)
  output.scrollTop = output.scrollHeight
}

async function runBoot() {
  for (const line of BOOT_LINES) {
    await sleep(line.delay === 0 ? 0 : 40 + Math.random() * 30)
    writeLine(line.text, line.cls)
  }

  await sleep(200)
  state = 'login-username'
  showInput('login: ')
}

function showInput(promptText) {
  prompt.textContent = promptText
  inputLine.hidden = false
  input.type = state === 'login-password' ? 'password' : 'text'
  input.value = ''
  input.focus()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function handleEnter() {
  const val = input.value
  input.value = ''

  if (state === 'login-username') {
    username = val.trim()
    writeLine(`login: ${username}`, 'tty__login-label')
    state = 'login-password'
    showInput('password: ')
    return
  }

  if (state === 'login-password') {
    password = val
    writeLine('password: ', 'tty__login-label')
    inputLine.hidden = true

    writeLine('', '')
    writeLine('Authenticating...', 'tty__boot-line--dim')

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (data.success) {
        csrfToken = data.csrf_token ?? ''
        writeLine(`Welcome, ${username}!`, 'tty__boot-line--ok')
        writeLine(
          "Type 'help' for available commands. Type 'startx' to launch the GUI.",
          'tty__boot-line--dim',
        )
        writeLine('', '')
        state = 'shell'
        showInput(`${username}@webdesktop:~$ `)
      } else {
        writeLine(`Login failed: ${data.error ?? 'incorrect credentials'}`, 'tty__boot-line--err')
        writeLine('', '')
        state = 'login-username'
        username = ''
        password = ''
        showInput('login: ')
      }
    } catch {
      writeLine('Connection error. Please try again.', 'tty__boot-line--err')
      state = 'login-username'
      username = ''
      password = ''
      showInput('login: ')
    }
    return
  }

  if (state === 'shell') {
    const cmd = val.trim()
    const promptText = `${username}@webdesktop:~$`

    if (cmd) {
      commandHistory.unshift(cmd)
      if (commandHistory.length > 100) commandHistory.pop()
    }
    historyIndex = -1

    if (!cmd) {
      writeShellLine(promptText, '', '')
      return
    }

    try {
      const res = await fetch('/apps/terminal/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ command: cmd }),
      })

      const result = await res.json()
      writeShellLine(promptText, cmd, result.output ?? '')

      if (result.action === 'clear') {
        while (output.firstChild !== inputLine) output.removeChild(output.firstChild)
      } else if (result.action === 'logout') {
        await doLogout()
      } else if (result.action === 'startx') {
        await sleep(300)
        window.location.href = '/gui'
      } else if (result.action === 'theme' && result.themeValue) {
        tty.setAttribute('data-theme', result.themeValue)
      }
    } catch {
      writeShellLine(promptText, cmd, 'Error: could not reach server')
    }
  }
}

async function doLogout() {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // ignore
  }

  state = 'login-username'
  username = ''
  password = ''
  csrfToken = ''
  commandHistory = []
  historyIndex = -1

  output.innerHTML = ''
  output.appendChild(inputLine)
  inputLine.hidden = true
  writeLine('', '')
  writeLine('Logged out.', 'tty__boot-line--dim')
  writeLine('', '')
  await sleep(300)
  state = 'login-username'
  showInput('login: ')
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    handleEnter()
  } else if (e.key === 'ArrowUp' && state === 'shell') {
    e.preventDefault()
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++
      input.value = commandHistory[historyIndex] ?? ''
    }
  } else if (e.key === 'ArrowDown' && state === 'shell') {
    e.preventDefault()
    if (historyIndex > 0) {
      historyIndex--
      input.value = commandHistory[historyIndex] ?? ''
    } else {
      historyIndex = -1
      input.value = ''
    }
  } else if (e.key === 'l' && e.ctrlKey && state === 'shell') {
    e.preventDefault()
    while (output.firstChild !== inputLine) output.removeChild(output.firstChild)
  }
})

// Keep focus on input when clicking anywhere in the tty
tty.addEventListener('click', () => {
  if (!inputLine.hidden) input.focus()
})

// Start boot sequence
runBoot()
