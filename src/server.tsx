import { terminalApp } from '@/apps/terminal'
import { csrfMiddleware, sessionMiddleware } from '@/auth/middleware'
import { auth } from '@/auth/routes'
import { Window } from '@/components/Window'
import { Terminal } from '@/components/apps/Terminal'
import { db } from '@/db/client'
import { sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { getCookie } from 'hono/cookie'

const app = new Hono()

// Security headers
app.use('*', async (c, next) => {
  await next()
  c.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  )
  c.header('X-Frame-Options', 'DENY')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
})

// Static files
app.use('/public/*', serveStatic({ root: './' }))

// Auth routes
app.route('/auth', auth)

// TTY / terminal page
app.get('/', async (c) => {
  const sessionId = getCookie(c, 'session_id')
  let sessionData: { role: string; username: string; csrfToken: string } | null = null
  if (sessionId) {
    const now = new Date().toISOString()
    const row = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)
      .then((rows) => rows[0])
    if (row && row.expiresAt > now) {
      const username = row.role === 'owner' ? (process.env.OWNER_USERNAME ?? 'admin') : 'guest'
      sessionData = { role: row.role, username, csrfToken: row.csrfToken }
    }
  }

  const sessionAttrs = sessionData
    ? ` data-session-role="${sessionData.role}" data-session-username="${sessionData.username}" data-session-csrf="${sessionData.csrfToken}"`
    : ''

  return c.html(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>fjallos</title>
  <link rel="stylesheet" href="/public/css/reset.css" />
  <link rel="stylesheet" href="/public/css/tokens.css" />
  <link rel="stylesheet" href="/public/css/apps/terminal.css" />
</head>
<body class="tty-body">
  <div class="tty" id="tty" data-theme="dark"${sessionAttrs}>
    <div class="tty__output" id="tty-output" aria-live="polite" role="log">
      <div class="tty__input-line" id="tty-input-line" hidden>
        <span class="tty__prompt" id="tty-prompt" aria-hidden="true"></span>
        <input
          class="tty__input"
          id="tty-input"
          type="text"
          aria-label="TTY input"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          spellcheck="false"
        />
      </div>
    </div>
  </div>
  <script src="/public/js/terminal.js" type="module"></script>
</body>
</html>`,
  )
})

// GUI route
app.get('/gui', async (c) => {
  const sessionId = getCookie(c, 'session_id')
  let session = null
  if (sessionId) {
    const now = new Date().toISOString()
    session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)
      .then((rows) => rows[0])
    if (session && session.expiresAt < now) {
      session = null
    }
  }

  if (session) {
    const reset = c.req.query('reset') === '1'
    return c.html(getDesktopHTML(session.role as 'owner' | 'guest', session.csrfToken, reset))
  }

  return c.html(getGuiLoginHTML())
})

app.get('/gui/login', (c) => {
  return c.html(getGuiLoginHTML())
})

// Window management
app.post('/windows/open', sessionMiddleware, async (c) => {
  let appName = 'terminal'
  try {
    const body = await c.req.json<{ app?: string }>()
    if (body.app) appName = body.app
  } catch {
    try {
      const form = await c.req.formData()
      const v = form.get('app')
      if (v) appName = v.toString()
    } catch {
      // use default
    }
  }

  const allowedApps = ['terminal']
  if (!allowedApps.includes(appName)) {
    return c.json({ error: 'Unknown app' }, 400)
  }

  const winId = crypto.randomUUID().slice(0, 8)
  const titleMap: Record<string, string> = { terminal: 'Terminal' }

  const windowHtml = (
    <Window
      id={winId}
      app={appName}
      title={titleMap[appName] ?? appName}
      x={120}
      y={80}
      width={700}
      height={500}
      zIndex={10}
    />
  )

  const taskbarUpdate = (
    <div id="taskbar-apps" hx-swap-oob="beforeend">
      <li>
        <button
          id={`taskbar-btn-${winId}`}
          type="button"
          class="taskbar__app-btn taskbar__app-btn--running"
          data-win-id={`win-${winId}`}
          onclick={`document.getElementById('win-${winId}')?.classList.remove('window--minimised')`}
        >
          {titleMap[appName] ?? appName}
        </button>
      </li>
    </div>
  )

  return c.html(
    <>
      {windowHtml}
      {taskbarUpdate}
    </>,
  )
})

app.delete('/windows/:id', sessionMiddleware, csrfMiddleware, (c) => {
  const id = c.req.param('id')
  return c.html(<button id={`taskbar-btn-${id}`} hx-swap-oob="delete"></button>)
})

// App content - register terminal route BEFORE wildcard
app.route('/apps/terminal', terminalApp)

app.get('/apps/:appName', sessionMiddleware, async (c) => {
  const appName = c.req.param('appName')
  const session = c.get('session')
  const username = session.role === 'owner' ? (process.env.OWNER_USERNAME ?? 'admin') : 'guest'

  if (appName === 'terminal') {
    return c.html(<Terminal role={session.role} username={username} />)
  }
  return c.notFound()
})

function getDesktopHTML(role: 'owner' | 'guest', csrfToken: string, reset = false): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>fjallos — Desktop</title>
  <link rel="stylesheet" href="/public/css/reset.css" />
  <link rel="stylesheet" href="/public/css/tokens.css" />
  <link rel="stylesheet" href="/public/css/desktop.css" />
  <link rel="stylesheet" href="/public/css/window.css" />
  <link rel="stylesheet" href="/public/css/apps/terminal.css" />
  <script src="https://unpkg.com/htmx.org@2.0.3" defer></script>
  <script src="/public/js/window-manager.js" type="module" defer></script>
</head>
<body>
  <div class="desktop" data-theme="dark" id="desktop" data-csrf="${csrfToken}" data-role="${role}"${reset ? ' data-reset-layout="1"' : ''}>
    <div class="desktop__wallpaper" aria-hidden="true"></div>
    <div class="desktop__windows" id="windows-container"></div>
    <ul class="context-menu" id="desktop-context-menu" popover="manual" role="menu">
      <li><button class="context-menu__item" role="menuitem"
        hx-post="/windows/open" hx-vals='{"app":"terminal"}' hx-target="#windows-container"
        hx-swap="beforeend" hx-headers='js:{"HX-CSRF-Token": document.getElementById("desktop").dataset.csrf}'
        onclick="document.getElementById('desktop-context-menu').hidePopover()">
        Open Terminal
      </button></li>
    </ul>
    <footer class="taskbar" id="taskbar" role="toolbar" aria-label="Taskbar">
      <div class="taskbar__start">
        <button class="taskbar__launcher" aria-label="App launcher">
          <span class="taskbar__launcher-icon" aria-hidden="true">⊞</span>
        </button>
      </div>
      <div class="taskbar__apps" id="taskbar-apps" role="list" aria-label="Running applications">
        <button
          class="taskbar__app-btn"
          role="listitem"
          aria-label="Open Terminal"
          hx-post="/windows/open"
          hx-vals='{"app":"terminal"}'
          hx-target="#windows-container"
          hx-swap="beforeend"
          hx-headers='js:{"HX-CSRF-Token": document.getElementById("desktop").dataset.csrf}'
        >
          <span aria-hidden="true">⬛</span> Terminal
        </button>
      </div>
      <div class="taskbar__tray">
        <span class="taskbar__role">${role}</span>
        <button class="taskbar__tty-btn" onclick="window.location.href='/'">TTY</button>
        <time class="taskbar__clock" id="taskbar-clock">--:--</time>
      </div>
    </footer>
  </div>
  <script>
    function updateClock() {
      const el = document.getElementById('taskbar-clock')
      if (el) {
        const now = new Date()
        el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        el.setAttribute('datetime', now.toISOString())
      }
    }

    // Desktop right-click context menu
    const contextMenu = document.getElementById('desktop-context-menu')
    const wallpaper = document.querySelector('.desktop__wallpaper')
    document.getElementById('desktop').addEventListener('contextmenu', (e) => {
      if (e.target.closest('.window') || e.target.closest('.taskbar')) return
      e.preventDefault()
      contextMenu.style.left = e.clientX + 'px'
      contextMenu.style.top = e.clientY + 'px'
      contextMenu.showPopover()
    })
    document.addEventListener('click', () => contextMenu.hidePopover())
    updateClock()
    setInterval(updateClock, 1000)
  </script>
</body>
</html>`
}

function getGuiLoginHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>fjallos — Login</title>
  <link rel="stylesheet" href="/public/css/reset.css" />
  <link rel="stylesheet" href="/public/css/tokens.css" />
  <link rel="stylesheet" href="/public/css/desktop.css" />
</head>
<body>
  <div class="gui-boot" id="gui-boot" aria-hidden="true"></div>
  <div class="gui-login" id="gui-login">
    <div class="desktop__wallpaper gui-login__wallpaper" aria-hidden="true"></div>
    <div class="login-card">
      <h1 class="login-card__title">fjallos</h1>
      <p class="login-card__subtitle">Personal Web Desktop</p>
      <form class="login-card__form" id="login-form" autocomplete="off">
        <div class="login-card__field">
          <label for="gui-username" class="login-card__label">Username</label>
          <input id="gui-username" name="username" type="text" class="login-card__input" autocomplete="username" required />
        </div>
        <div class="login-card__field">
          <label for="gui-password" class="login-card__label">Password</label>
          <input id="gui-password" name="password" type="password" class="login-card__input" autocomplete="current-password" />
        </div>
        <div class="login-card__error" id="login-error" role="alert" hidden></div>
        <button type="submit" class="login-card__btn login-card__btn--primary">Log In</button>
        <button type="button" class="login-card__btn login-card__btn--guest" id="guest-btn">Continue as Guest</button>
      </form>
    </div>
  </div>
  <script>
    async function doLogin(username, password) {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (data.success) {
        if (document.startViewTransition) {
          document.startViewTransition(() => { window.location.href = '/gui' })
        } else {
          window.location.href = '/gui'
        }
      } else {
        const err = document.getElementById('login-error')
        if (err) { err.textContent = data.error || 'Login incorrect.'; err.hidden = false }
      }
    }
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault()
      doLogin(document.getElementById('gui-username').value, document.getElementById('gui-password').value)
    })
    document.getElementById('guest-btn').addEventListener('click', () => { doLogin('guest', '') })
    const boot = document.getElementById('gui-boot')
    const login = document.getElementById('gui-login')
    boot.style.display = 'flex'
    login.style.visibility = 'hidden'
    setTimeout(() => {
      boot.style.opacity = '0'
      setTimeout(() => {
        boot.style.display = 'none'
        login.style.visibility = 'visible'
        document.getElementById('gui-username').focus()
      }, 500)
    }, 1000)
  </script>
</body>
</html>`
}

const port = Number.parseInt(process.env.PORT ?? '3000', 10)
console.log(`Server starting on http://localhost:${port}`)

export default {
  port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
}
