/**
 * Window Manager
 */

const TASKBAR_HEIGHT = 40
const SNAP_THRESHOLD = 20
let highestZ = 10

// --- Taskbar app context menu ---

const appMenu = (() => {
  const el = document.createElement('ul')
  el.className = 'app-menu'
  el.setAttribute('popover', 'auto')
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el))
  return el
})()

function showAppMenu(launcher, app) {
  appMenu.innerHTML = ''

  const wins = [...document.querySelectorAll(`.window[data-app="${app}"]`)]
  wins.forEach((win, i) => {
    const li = document.createElement('li')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'app-menu__item'
    const label = win.dataset.title || `${app} ${i + 1}`
    const isMin = win.classList.contains('window--minimised')
    btn.textContent = `${label}${isMin ? ' (minimised)' : ''}`
    btn.addEventListener('click', () => {
      win.classList.remove('window--minimised')
      bringToFront(win)
      appMenu.hidePopover()
    })
    li.appendChild(btn)
    appMenu.appendChild(li)
  })

  if (wins.length > 0) {
    const divider = document.createElement('li')
    divider.className = 'app-menu__divider'
    appMenu.appendChild(divider)
  }

  const newLi = document.createElement('li')
  const newBtn = document.createElement('button')
  newBtn.type = 'button'
  newBtn.className = 'app-menu__item'
  newBtn.textContent = 'New window'
  newBtn.addEventListener('click', () => {
    openNewWindow(app)
    appMenu.hidePopover()
  })
  newLi.appendChild(newBtn)
  appMenu.appendChild(newLi)

  // Position above the launcher button
  const rect = launcher.getBoundingClientRect()
  appMenu.style.left = `${rect.left}px`
  appMenu.style.bottom = `${window.innerHeight - rect.top + 4}px`
  appMenu.style.top = 'auto'
  appMenu.showPopover()
}

function openNewWindow(app) {
  htmx.ajax('POST', '/windows/open', {
    target: '#windows-container',
    swap: 'beforeend',
    values: { app },
  })
}

function bringToFront(win) {
  highestZ++
  win.style.setProperty('--z', String(highestZ))
  document.querySelectorAll('.window--focused').forEach((w) => {
    if (w !== win) w.classList.remove('window--focused')
  })
  win.classList.add('window--focused')
}

function updateLauncherState(app) {
  if (!app) return
  const launcher = document.getElementById(`taskbar-launcher-${app}`)
  if (!launcher) return
  const hasWindows = document.querySelector(`.window[data-app="${app}"]`) !== null
  launcher.classList.toggle('taskbar__app-btn--active', hasWindows)
}

function getWindowRect(win) {
  return {
    x: parseInt(win.style.getPropertyValue('--x') || '100', 10),
    y: parseInt(win.style.getPropertyValue('--y') || '80', 10),
    w: parseInt(win.style.getPropertyValue('--w') || '700', 10),
    h: parseInt(win.style.getPropertyValue('--h') || '500', 10),
  }
}

function setWindowRect(win, rect) {
  if (rect.x !== undefined) win.style.setProperty('--x', `${rect.x}px`)
  if (rect.y !== undefined) win.style.setProperty('--y', `${rect.y}px`)
  if (rect.w !== undefined) win.style.setProperty('--w', `${rect.w}px`)
  if (rect.h !== undefined) win.style.setProperty('--h', `${rect.h}px`)
}

function setupDrag(win) {
  const chrome = win.querySelector('.window__chrome')
  if (!chrome) return

  let dragging = false
  let startX = 0
  let startY = 0
  let startWinX = 0
  let startWinY = 0
  let snapped = null

  chrome.addEventListener('mousedown', (e) => {
    if (e.target.closest('.window__controls')) return
    if (win.classList.contains('window--maximised')) return

    dragging = true
    startX = e.clientX
    startY = e.clientY
    const rect = getWindowRect(win)
    startWinX = rect.x
    startWinY = rect.y
    snapped = null

    bringToFront(win)
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return

    const dx = e.clientX - startX
    const dy = e.clientY - startY
    let newX = startWinX + dx
    let newY = startWinY + dy

    const vw = window.innerWidth
    const vh = window.innerHeight - TASKBAR_HEIGHT

    if (newX < SNAP_THRESHOLD) {
      snapped = 'left'
    } else if (newX + getWindowRect(win).w > vw - SNAP_THRESHOLD) {
      snapped = 'right'
    } else {
      snapped = null
    }

    newX = Math.max(0, Math.min(vw - 100, newX))
    newY = Math.max(0, Math.min(vh - 40, newY))

    setWindowRect(win, { x: newX, y: newY })
  })

  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false

    if (snapped === 'left') {
      win.classList.add('window--snapped-left')
      win.classList.remove('window--snapped-right')
    } else if (snapped === 'right') {
      win.classList.add('window--snapped-right')
      win.classList.remove('window--snapped-left')
    } else {
      win.classList.remove('window--snapped-left', 'window--snapped-right')
    }
  })
}

function setupResize(win) {
  const handles = [
    'window__resize-handle--se',
    'window__resize-handle--s',
    'window__resize-handle--e',
  ]

  handles.forEach((cls) => {
    const handle = document.createElement('div')
    handle.className = `window__resize-handle ${cls}`
    win.appendChild(handle)
  })

  let resizing = false
  let resizeType = ''
  let startX = 0
  let startY = 0
  let startW = 0
  let startH = 0

  win.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.window__resize-handle')
    if (!handle) return

    resizing = true
    if (handle.classList.contains('window__resize-handle--se')) resizeType = 'se'
    else if (handle.classList.contains('window__resize-handle--s')) resizeType = 's'
    else if (handle.classList.contains('window__resize-handle--e')) resizeType = 'e'

    startX = e.clientX
    startY = e.clientY
    const rect = getWindowRect(win)
    startW = rect.w
    startH = rect.h
    bringToFront(win)
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY

    let newW = startW
    let newH = startH

    if (resizeType === 'se' || resizeType === 'e') newW = Math.max(300, startW + dx)
    if (resizeType === 'se' || resizeType === 's') newH = Math.max(200, startH + dy)

    setWindowRect(win, { w: newW, h: newH })
  })

  document.addEventListener('mouseup', () => {
    resizing = false
  })
}

function setupControls(win) {
  win.addEventListener('click', (e) => {
    const btn = e.target.closest('.window__btn')
    if (!btn) return

    const action = btn.dataset.action

    if (action === 'minimise') {
      win.classList.toggle('window--minimised')
      const winId = win.id
      const taskbarBtn = document.querySelector(`[data-win-id="${winId}"]`)
      if (taskbarBtn) {
        taskbarBtn.classList.toggle(
          'taskbar__app-btn--minimised',
          win.classList.contains('window--minimised'),
        )
      }
      saveAllLayouts()
    } else if (action === 'maximise') {
      const wasMaximised = win.classList.contains('window--maximised')
      win.classList.toggle('window--maximised')
      if (wasMaximised) {
        win.classList.remove('window--snapped-left', 'window--snapped-right')
      }
      saveAllLayouts()
    }
  })

  win.addEventListener('mousedown', () => {
    bringToFront(win)
  })
}

export function setupWindow(win) {
  setupDrag(win)
  setupResize(win)
  setupControls(win)
  applyPendingRestore(win)
  bringToFront(win)
}

// --- sessionStorage window persistence ---
// Saves the full ordered list of open windows (app + geometry) so they can be
// re-opened after a page refresh within the same browser session.

const STORAGE_KEY = 'wm_windows'

// Per-app queue of pending geometry to apply to the next new window of that app.
const pendingRestores = {}

function saveAllLayouts() {
  const container = document.getElementById('windows-container')
  if (!container) return
  const windows = []
  container.querySelectorAll('.window').forEach((win) => {
    windows.push({
      app: win.dataset.app,
      ...getWindowRect(win),
      minimised: win.classList.contains('window--minimised'),
      maximised: win.classList.contains('window--maximised'),
    })
  })
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(windows))
}

function queueRestore(app, layout) {
  if (!pendingRestores[app]) pendingRestores[app] = []
  pendingRestores[app].push(layout)
}

function applyPendingRestore(win) {
  const app = win.dataset.app
  if (!app || !pendingRestores[app]?.length) return
  const layout = pendingRestores[app].shift()
  setWindowRect(win, layout)
  if (layout.minimised) win.classList.add('window--minimised')
  if (layout.maximised) win.classList.add('window--maximised')
}

function observeWindows() {
  const desktop = document.getElementById('desktop')
  if (desktop?.dataset.resetLayout === '1') {
    sessionStorage.removeItem(STORAGE_KEY)
  }

  const container = document.getElementById('windows-container')
  if (!container) return

  // Save layout on any window move/resize via pointer events
  document.addEventListener('pointerup', saveAllLayouts)

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement && node.classList.contains('window')) {
          setupWindow(node)
          updateLauncherState(node.dataset.app)
        }
      })
      mutation.removedNodes.forEach((node) => {
        if (node instanceof HTMLElement && node.classList.contains('window')) {
          updateLauncherState(node.dataset.app)
        }
      })
      saveAllLayouts()
    })
  })

  observer.observe(container, { childList: true })
  container.querySelectorAll('.window').forEach(setupWindow)

  // Re-open windows that were open before the page refresh
  const saved = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })()
  for (const entry of saved) {
    if (!entry.app) continue
    queueRestore(entry.app, entry)
    htmx.ajax('POST', '/windows/open', {
      target: '#windows-container',
      swap: 'beforeend',
      values: { app: entry.app },
    })
  }

  // Taskbar launcher: left-click focuses top window or opens new; right-click shows menu
  const taskbarApps = document.getElementById('taskbar-apps')

  taskbarApps?.addEventListener(
    'click',
    (e) => {
      const btn = e.target.closest('[data-app]')
      if (!btn) return
      e.preventDefault()
      const app = btn.dataset.app
      const wins = [...document.querySelectorAll(`.window[data-app="${app}"]`)]
      if (wins.length > 0) {
        const top = wins.reduce((a, b) =>
          parseInt(a.style.getPropertyValue('--z') || '0') >=
          parseInt(b.style.getPropertyValue('--z') || '0')
            ? a
            : b,
        )
        top.classList.remove('window--minimised')
        bringToFront(top)
      } else {
        openNewWindow(app)
      }
    },
    { capture: true },
  )

  taskbarApps?.addEventListener('contextmenu', (e) => {
    const btn = e.target.closest('[data-app]')
    if (!btn) return
    e.preventDefault()
    showAppMenu(btn, btn.dataset.app)
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeWindows)
} else {
  observeWindows()
}
