import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { getCookie } from 'hono/cookie'
import { auth } from '@/auth/routes'
import { sessionMiddleware } from '@/auth/middleware'
import { terminalApp } from '@/apps/terminal'
import { Terminal } from '@/components/apps/Terminal'
import { Window } from '@/components/Window'
import { db } from '@/db/client'
import { sessions } from '@/db/schema'

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
app.get('/', (c) => {
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
  <div class="tty" id="tty" data-theme="dark">
    <div class="tty__output" id="tty-output" aria-live="polite" role="log"></div>
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
    return c.html(getDesktopHTML(session.role as 'owner' | 'guest', session.csrfToken))
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
    <Window id={winId} app={appName} title={titleMap[appName] ?? appName} x={120} y={80} width={700} height={500} zIndex={10} />
  )

  const taskbarUpdate = (
    <div id="taskbar-apps" hx-swap-oob="beforeend">
      <button
        class="taskbar__app-btn taskbar__app-btn--running"
        data-win-id={`win-${winId}`}
        onclick={`document.getElementById('win-${winId}')?.classList.remove('window--minimised')`}
      >
        {titleMap[appName] ?? appName}
      </button>
    </div>
  )

  return c.html(
    <>
      {windowHtml}
      {taskbarUpdate}
    </>,
  )
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

function getDesktopHTML(role: 'owner' | 'guest', csrfToken: string): string {
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
  <div class="desktop" data-theme="dark" id="desktop" data-csrf="${csrfToken}" data-role="${role}">
    <div class="desktop__wallpaper" aria-hidden="true"></div>
    <div class="desktop__windows" id="windows-container"></div>
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
        window.location.href = '/gui'
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

const port = parseInt(process.env.PORT ?? '3000', 10)
console.log(`Server starting on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
