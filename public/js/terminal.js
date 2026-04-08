/**
 * TTY Terminal Client
 * Handles boot sequence, login, and shell command execution.
 */

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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
let bootAborted = false
let cwd = '~'

const BOOT_LINES = [
  { text: 'fjallos v0.1.0 -- personal web desktop', cls: 'tty__boot-line--info', delay: 0 },
  { text: 'Copyright (c) 2026. All rights reserved.', cls: 'tty__boot-line--dim', delay: 60 },
  { text: '', cls: '', delay: 80 },
  {
    text: 'BIOS v2.8.4  |  CPU: Web-Core i9 @ 4.20GHz  |  RAM: 16384MB',
    cls: 'tty__boot-line--dim',
    delay: 120,
  },
  { text: '', cls: '', delay: 140 },
  { text: '[    0.000] Initializing kernel...', cls: 'tty__boot-line--dim', delay: 200 },
  { text: '[    0.004] Loading initial ramdisk...', cls: 'tty__boot-line--dim', delay: 240 },
  {
    text: '[    0.011] Decompressing kernel image...   [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 290,
  },
  {
    text: '[    0.019] Initializing memory manager...  [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 340,
  },
  { text: '[    0.027] Scanning PCI bus...', cls: 'tty__boot-line--dim', delay: 380 },
  { text: '[    0.031]   0000:00:00.0  Host bridge', cls: 'tty__boot-line--dim', delay: 410 },
  {
    text: '[    0.033]   0000:00:02.0  VGA compatible controller',
    cls: 'tty__boot-line--dim',
    delay: 430,
  },
  { text: '[    0.035]   0000:00:1f.2  SATA controller', cls: 'tty__boot-line--dim', delay: 450 },
  { text: '[    0.041] Loading device drivers...', cls: 'tty__boot-line--dim', delay: 490 },
  {
    text: '[    0.048]   drv: input/keyboard             [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 530,
  },
  {
    text: '[    0.052]   drv: net/virtio-net             [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 570,
  },
  {
    text: '[    0.061]   drv: storage/nvme               [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 610,
  },
  {
    text: '[    0.074]   drv: gpu/webgl2                 [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 650,
  },
  { text: '[    0.089] Mounting filesystems...', cls: 'tty__boot-line--dim', delay: 700 },
  {
    text: '[    0.094]   /              ext4     rw,relatime  [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 740,
  },
  {
    text: '[    0.097]   /tmp           tmpfs    rw,nosuid    [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 770,
  },
  {
    text: '[    0.102]   /home          ext4     rw,relatime  [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 810,
  },
  {
    text: '[    0.118] Starting udev daemon...           [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 860,
  },
  { text: '[    0.135] Configuring network interfaces...', cls: 'tty__boot-line--dim', delay: 910 },
  {
    text: '[    0.141]   eth0: link up 1000Mbps full-duplex',
    cls: 'tty__boot-line--dim',
    delay: 950,
  },
  {
    text: '[    0.148]   eth0: acquired address via DHCP  [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 990,
  },
  {
    text: '[    0.161] Starting system logger...         [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 1040,
  },
  {
    text: '[    0.179] Starting cron daemon...           [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 1080,
  },
  {
    text: '[    0.204] Starting SSH daemon...            [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 1120,
  },
  { text: '[    0.221] Initialising SQLite database...', cls: 'tty__boot-line--dim', delay: 1170 },
  {
    text: '[    0.228]   checking schema integrity...    [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 1210,
  },
  {
    text: '[    0.235]   running pending migrations...   [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 1250,
  },
  {
    text: '[    0.251] Starting session manager...       [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 1300,
  },
  {
    text: '[    0.274] Starting web server on :3000...   [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 1350,
  },
  {
    text: '[    0.288] Starting virtual filesystem...    [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 1390,
  },
  {
    text: '[    0.301] Loading shell environment...      [ OK ]',
    cls: 'tty__boot-line--ok',
    delay: 1430,
  },
  { text: '[    0.312] Reached target: System ready.', cls: 'tty__boot-line--info', delay: 1490 },
  { text: '', cls: '', delay: 1540 },
  { text: 'fjallos login:', cls: 'tty__boot-line--info', delay: 1600 },
]

function writeLine(text, cls = '') {
  const line = document.createElement('span')
  line.className = `tty__boot-line${cls ? ' ' + cls : ''}`
  line.textContent = text
  output.insertBefore(line, inputLine)
  output.scrollTop = output.scrollHeight
}

/** @param {string} html — server-generated ANSI→HTML (text is already escaped) */
function writeShellLine(promptText, cmd, html) {
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

  if (html) {
    const o = document.createElement('pre')
    o.className = 'tty__shell-output'
    o.innerHTML = html
    entry.appendChild(o)
  }

  output.insertBefore(entry, inputLine)
  output.scrollTop = output.scrollHeight
}

function getPromptText() {
  return `${username}@webdesktop:${cwd}$`
}

/** Read SSE events from a fetch Response. Calls onHtml for each html fragment. */
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

async function runBoot() {
  for (const line of BOOT_LINES) {
    if (bootAborted) break
    await sleep(line.delay === 0 ? 0 : 40 + Math.random() * 30)
    if (bootAborted) break
    writeLine(line.text, line.cls)
  }

  await sleep(bootAborted ? 0 : 200)
  bootAborted = false
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
        writeLine(`Logged in as: ${username}`, 'tty__boot-line--ok')
        writeLine(
          "Type 'help' for available commands. Type 'startx' to launch the desktop.",
          'tty__boot-line--dim',
        )
        writeLine('', '')
        cwd = '~'
        state = 'shell'
        showInput(`${getPromptText()} `)
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
    const promptText = getPromptText()

    if (cmd) {
      commandHistory.unshift(cmd)
      if (commandHistory.length > 100) commandHistory.pop()
    }
    historyIndex = -1

    if (!cmd) {
      writeShellLine(promptText, '', '')
      return
    }

    // Client-side commands — never sent to server
    if (cmd === 'history') {
      const lines =
        commandHistory.length > 1
          ? [...commandHistory]
              .reverse()
              .map((c, i) => `${String(i + 1).padStart(4, ' ')}  ${escapeHtml(c)}`)
              .join('\n')
          : '(no history)'
      writeShellLine(promptText, 'history', lines)
      showInput(`${getPromptText()} `)
      return
    }

    inputLine.hidden = true

    try {
      const res = await fetch('/apps/terminal/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ command: cmd, cwd, mode: 'tty' }),
      })

      let accumulatedHtml = ''
      const result = await readStream(res, (html) => {
        accumulatedHtml += html
      })

      writeShellLine(promptText, cmd, accumulatedHtml)

      if (result) {
        if (result.newCwd) {
          cwd = result.newCwd
        }
        if (result.action === 'clear') {
          while (output.firstChild !== inputLine) output.removeChild(output.firstChild)
        } else if (result.action === 'logout') {
          await doLogout()
          return
        } else if (result.action === 'reboot') {
          await doReboot()
          return
        } else if (result.action === 'startx' || result.action === 'startx-reset') {
          await sleep(300)
          const dest = result.action === 'startx-reset' ? '/gui?reset=1' : '/gui'
          if (document.startViewTransition) {
            document.startViewTransition(() => {
              window.location.href = dest
            })
          } else {
            window.location.href = dest
          }
          return
        } else if (result.action === 'theme' && result.themeValue) {
          tty.setAttribute('data-theme', result.themeValue)
        }
      }
    } catch {
      writeShellLine(promptText, cmd, '<span class="ansi-red">Error: could not reach server</span>')
    }

    showInput(`${getPromptText()} `)
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
  cwd = '~'
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

async function doReboot() {
  inputLine.hidden = true
  writeLine('', '')
  writeLine('Broadcast message: System going down for reboot NOW!', 'tty__boot-line--warn')
  writeLine('', '')

  try {
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // ignore
  }

  await sleep(800)
  window.location.href = '/'
}

// Boot skip: listen on document so it works before the input is shown
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Escape' || (e.key === 'c' && e.ctrlKey)) && state === 'booting') {
    e.preventDefault()
    bootAborted = true
  }
})

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

// Restore existing session or run boot sequence
const existingRole = tty.dataset.sessionRole
const existingUsername = tty.dataset.sessionUsername
const existingCsrf = tty.dataset.sessionCsrf

if (existingRole && existingUsername && existingCsrf) {
  username = existingUsername
  csrfToken = existingCsrf
  cwd = '~'
  state = 'shell'
  showInput(`${getPromptText()} `)
} else {
  runBoot()
}
