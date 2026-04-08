import {
  createNode,
  deleteNode,
  ensureRoot,
  getChildren,
  getNodeByPath,
  resolvePath,
  updateContent,
} from '@/lib/fs'

export interface ShellContext {
  role: 'owner' | 'guest'
  username: string
  cwd: string
  mode: 'tty' | 'gui'
}

export interface CommandResult {
  output: string
  exitCode: number
  newCwd?: string
  action?: 'clear' | 'logout' | 'reboot' | 'startx' | 'startx-reset' | 'theme' | 'close-window'
  themeValue?: string
}

const HELP_TEXT = `Available commands:
  help              Show this help message
  clear             Clear the terminal
  echo [text]       Print text to the terminal
  ls [path]         List files in directory
  pwd               Print working directory
  cd [path]         Change directory (~ to go home)
  cat <file>        Print file contents
  mkdir <dir>       Create a directory
  touch <file>      Create an empty file
  rm <path>         Remove a file
  fetch <url>       Fetch a URL (http/https only)
  whoami            Show current user
  projects          List projects
  cv                Show curriculum vitae / resume
  contact           Show contact information
  theme [name]      Change terminal theme (dark/light/matrix/retro)
  reboot            Reboot the system (TTY only)
  login             Log in as owner
  logout            Log out and return to login prompt
  exit              Exit shell
  startx            Launch the graphical desktop environment (TTY only)`

const PROJECTS_TEXT = `Projects:
  ┌─────────────────────────────────────────────────────┐
  │  fjallos        Personal web desktop (this site!)   │
  │  [more projects coming soon...]                     │
  └─────────────────────────────────────────────────────┘

Type 'startx' to explore projects interactively in the GUI.`

// TODO: Replace placeholder CV content with real personal information before deployment
const CV_TEXT = `Curriculum Vitae
════════════════

[Your Name]
Software Engineer

Experience:
  • Building cool things on the web
  • [Add your experience here]

Education:
  • [Add your education here]

Skills:
  TypeScript, Bun, Node.js, React, CSS, SQL, Linux

Contact: see 'contact' command`

// TODO: Replace placeholder contact information with real contact details before deployment
const CONTACT_TEXT = `Contact Information
═══════════════════

  Email:    [your@email.com]
  GitHub:   https://github.com/[username]
  LinkedIn: https://linkedin.com/in/[username]

Type 'startx' to see more in the GUI.`

export async function executeCommand(input: string, context: ShellContext): Promise<CommandResult> {
  const trimmed = input.trim()
  const parts = trimmed.split(/\s+/)
  const cmd = parts[0]?.toLowerCase() ?? ''
  const args = parts.slice(1)

  let result: CommandResult

  switch (cmd) {
    case '':
      result = { output: '', exitCode: 0 }
      break

    case 'help':
      result = { output: HELP_TEXT, exitCode: 0 }
      break

    case 'clear':
      result = { output: '', exitCode: 0, action: 'clear' }
      break

    case 'echo':
      result = { output: args.join(' '), exitCode: 0 }
      break

    case 'pwd':
      result = { output: context.cwd, exitCode: 0 }
      break

    case 'whoami':
      result = { output: context.username, exitCode: 0 }
      break

    case 'ls': {
      const targetPath = args[0] ? resolvePath(context.cwd, args[0]) : context.cwd
      const listing = await listDirectory(targetPath)
      result = { output: listing, exitCode: listing.startsWith('ls:') ? 1 : 0 }
      break
    }

    case 'cd': {
      const targetPath = args[0] ? resolvePath(context.cwd, args[0]) : '~'
      const node = await getNodeByPath(targetPath)
      if (!node) {
        result = { output: `cd: ${args[0]}: No such file or directory`, exitCode: 1 }
      } else if (node.type !== 'dir') {
        result = { output: `cd: ${args[0]}: Not a directory`, exitCode: 1 }
      } else {
        result = { output: '', exitCode: 0, newCwd: targetPath }
      }
      break
    }

    case 'cat': {
      if (!args[0]) {
        result = { output: 'Usage: cat <file>', exitCode: 1 }
        break
      }
      const targetPath = resolvePath(context.cwd, args[0])
      const node = await getNodeByPath(targetPath)
      if (!node) {
        result = { output: `cat: ${args[0]}: No such file or directory`, exitCode: 1 }
      } else if (node.type === 'dir') {
        result = { output: `cat: ${args[0]}: Is a directory`, exitCode: 1 }
      } else {
        result = { output: node.content ?? '', exitCode: 0 }
      }
      break
    }

    case 'mkdir': {
      if (!args[0]) {
        result = { output: 'Usage: mkdir <directory>', exitCode: 1 }
        break
      }
      const name = args[0]
      const parentPath = name.includes('/')
        ? resolvePath(context.cwd, name.split('/').slice(0, -1).join('/'))
        : context.cwd
      const dirName = name.split('/').pop() ?? name
      const parent = await getNodeByPath(parentPath)
      if (!parent) {
        result = {
          output: `mkdir: cannot create directory '${name}': No such file or directory`,
          exitCode: 1,
        }
        break
      }
      if (parent.type !== 'dir') {
        result = {
          output: `mkdir: cannot create directory '${name}': Not a directory`,
          exitCode: 1,
        }
        break
      }
      const existing = (await getChildren(parent.id)).find((c) => c.name === dirName)
      if (existing) {
        result = { output: `mkdir: cannot create directory '${name}': File exists`, exitCode: 1 }
        break
      }
      await createNode(parent.id, dirName, 'dir')
      result = { output: '', exitCode: 0 }
      break
    }

    case 'touch': {
      if (!args[0]) {
        result = { output: 'Usage: touch <file>', exitCode: 1 }
        break
      }
      const name = args[0]
      const parentPath = name.includes('/')
        ? resolvePath(context.cwd, name.split('/').slice(0, -1).join('/'))
        : context.cwd
      const fileName = name.split('/').pop() ?? name
      const parent = await getNodeByPath(parentPath)
      if (!parent) {
        result = { output: `touch: cannot touch '${name}': No such file or directory`, exitCode: 1 }
        break
      }
      if (parent.type !== 'dir') {
        result = { output: `touch: cannot touch '${name}': Not a directory`, exitCode: 1 }
        break
      }
      const existing = (await getChildren(parent.id)).find((c) => c.name === fileName)
      if (existing) {
        await updateContent(existing.id, existing.content ?? '')
        result = { output: '', exitCode: 0 }
      } else {
        await createNode(parent.id, fileName, 'file', '')
        result = { output: '', exitCode: 0 }
      }
      break
    }

    case 'rm': {
      if (!args[0]) {
        result = { output: 'Usage: rm <file>', exitCode: 1 }
        break
      }
      const targetPath = resolvePath(context.cwd, args[0])
      const node = await getNodeByPath(targetPath)
      if (!node) {
        result = {
          output: `rm: cannot remove '${args[0]}': No such file or directory`,
          exitCode: 1,
        }
      } else if (node.type === 'dir') {
        result = {
          output: `rm: cannot remove '${args[0]}': Is a directory (use rm -r... just kidding, not implemented)`,
          exitCode: 1,
        }
      } else {
        await deleteNode(node.id)
        result = { output: '', exitCode: 0 }
      }
      break
    }

    case 'fetch': {
      const urlStr = args[0]
      if (!urlStr) {
        result = { output: 'Usage: fetch <url>', exitCode: 1 }
        break
      }
      let url: URL
      try {
        url = new URL(urlStr)
      } catch {
        result = { output: `fetch: invalid URL: ${urlStr}`, exitCode: 1 }
        break
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        result = { output: 'fetch: only http and https URLs are supported', exitCode: 1 }
        break
      }
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        const response = await globalThis.fetch(url.toString(), {
          signal: controller.signal,
          headers: { 'User-Agent': 'fjallos/1.0' },
        })
        clearTimeout(timer)
        const text = await response.text()
        const body =
          text.length > 2000 ? `${text.slice(0, 2000)}\n\x1b[2m... (truncated)\x1b[0m` : text
        result = {
          output: `\x1b[32m${response.status} ${response.statusText}\x1b[0m\n\n${body}`,
          exitCode: 0,
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'unknown error'
        result = { output: `fetch: ${msg}`, exitCode: 1 }
      }
      break
    }

    case 'projects':
      result = { output: PROJECTS_TEXT, exitCode: 0 }
      break

    case 'cv':
      result = { output: CV_TEXT, exitCode: 0 }
      break

    case 'contact':
      result = { output: CONTACT_TEXT, exitCode: 0 }
      break

    case 'theme': {
      const themeName = args[0]
      const validThemes = ['dark', 'light', 'matrix', 'retro']
      if (!themeName) {
        result = {
          output: `Available themes: ${validThemes.join(', ')}\nUsage: theme <name>`,
          exitCode: 0,
        }
      } else if (!validThemes.includes(themeName)) {
        result = {
          output: `Unknown theme: ${themeName}\nAvailable: ${validThemes.join(', ')}`,
          exitCode: 1,
        }
      } else {
        result = {
          output: `Theme changed to: ${themeName}`,
          exitCode: 0,
          action: 'theme',
          themeValue: themeName,
        }
      }
      break
    }

    case 'login':
      result = {
        output: 'Use the login prompt. Type logout first if already logged in.',
        exitCode: 0,
      }
      break

    case 'logout':
      result = { output: 'Logging out...', exitCode: 0, action: 'logout' }
      break

    case 'reboot':
      if (context.mode === 'gui') {
        result = {
          output: 'reboot: not permitted in GUI mode. Use the TTY terminal to reboot.',
          exitCode: 1,
        }
      } else {
        result = { output: 'Rebooting...', exitCode: 0, action: 'reboot' }
      }
      break

    case 'exit':
      if (context.mode === 'gui') {
        result = { output: '', exitCode: 0, action: 'close-window' }
      } else {
        result = { output: 'Goodbye.', exitCode: 0, action: 'logout' }
      }
      break

    case 'startx':
      if (context.mode === 'gui') {
        result = {
          output: 'startx: already running in desktop environment.',
          exitCode: 1,
        }
      } else if (args[0] === '--reset') {
        result = {
          output: 'Starting graphical environment (resetting layout)...',
          exitCode: 0,
          action: 'startx-reset',
        }
      } else {
        result = { output: 'Starting graphical environment...', exitCode: 0, action: 'startx' }
      }
      break

    default:
      result = {
        output: `${cmd}: command not found\nType 'help' for available commands.`,
        exitCode: 127,
      }
  }

  return result
}

async function listDirectory(path: string): Promise<string> {
  const node = await getNodeByPath(path)
  if (!node) {
    const label = path === '~' ? '~' : path.replace(/^.*\//, '')
    return `ls: ${label}: No such file or directory`
  }
  if (node.type !== 'dir') {
    return `ls: ${path.replace(/^.*\//, '')}: Not a directory`
  }

  const children = await getChildren(node.id)
  if (children.length === 0) return ''

  return children
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((n) => (n.type === 'dir' ? `\x1b[34m${n.name}/\x1b[0m` : n.name))
    .join('  ')
}

// Ensure the virtual FS has a root node on first use
ensureRoot().catch(() => {})
