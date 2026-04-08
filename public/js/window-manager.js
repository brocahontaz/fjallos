/**
 * Window Manager
 */

const TASKBAR_HEIGHT = 40
const SNAP_THRESHOLD = 20
let highestZ = 10

function bringToFront(win) {
  highestZ++
  win.style.setProperty('--z', String(highestZ))
  document.querySelectorAll('.window--focused').forEach((w) => {
    if (w !== win) w.classList.remove('window--focused')
  })
  win.classList.add('window--focused')
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
    } else if (action === 'maximise') {
      const wasMaximised = win.classList.contains('window--maximised')
      win.classList.toggle('window--maximised')
      if (wasMaximised) {
        win.classList.remove('window--snapped-left', 'window--snapped-right')
      }
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
  restoreWindowState(win)
  bringToFront(win)
}

// --- sessionStorage layout persistence ---

const STORAGE_KEY = 'wm_layout'

function saveAllLayouts() {
  const container = document.getElementById('windows-container')
  if (!container) return
  const layout = {}
  container.querySelectorAll('.window').forEach((win) => {
    const id = win.id
    const rect = getWindowRect(win)
    layout[id] = {
      ...rect,
      minimised: win.classList.contains('window--minimised'),
      maximised: win.classList.contains('window--maximised'),
    }
  })
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
}

function restoreWindowState(win) {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return
  let layout
  try {
    layout = JSON.parse(raw)
  } catch {
    return
  }
  const saved = layout[win.id]
  if (!saved) return
  setWindowRect(win, saved)
  if (saved.minimised) win.classList.add('window--minimised')
  if (saved.maximised) win.classList.add('window--maximised')
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
        }
      })
      // Save when windows are removed too
      if (mutation.removedNodes.length) saveAllLayouts()
    })
  })

  observer.observe(container, { childList: true })
  container.querySelectorAll('.window').forEach(setupWindow)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeWindows)
} else {
  observeWindows()
}
