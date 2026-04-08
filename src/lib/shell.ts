import { db } from '@/db/client'
import { fsNodes, terminalHistory } from '@/db/schema'
import { eq, isNull } from 'drizzle-orm'

export interface ShellContext {
  role: 'owner' | 'guest'
  username: string
  cwd: string
}

export interface CommandResult {
  output: string
  exitCode: number
  action?: 'clear' | 'logout' | 'reboot' | 'startx' | 'startx-reset' | 'theme'
  themeValue?: string
}

const HELP_TEXT = `Available commands:
  help          Show this help message
  clear         Clear the terminal
  echo [text]   Print text to the terminal
  ls            List files in current directory
  pwd           Print working directory
  whoami        Show current user
  projects      List projects
  cv            Show curriculum vitae / resume
  contact       Show contact information
  theme [name]  Change terminal theme (dark/light/matrix/retro)
  reboot        Reboot the system
  login         Log in as owner
  logout        Log out and return to login prompt
  exit          Exit shell
  startx        Launch the graphical desktop environment`

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
      const listing = await listDirectory(context.cwd)
      result = { output: listing, exitCode: 0 }
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
      result = { output: 'Rebooting...', exitCode: 0, action: 'reboot' }
      break

    case 'exit':
      result = { output: 'Goodbye.', exitCode: 0, action: 'logout' }
      break

    case 'startx':
      if (args[0] === '--reset') {
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

  try {
    await db.insert(terminalHistory).values({
      command: trimmed,
      output: result.output,
      exitCode: result.exitCode,
    })
  } catch {
    // Non-fatal
  }

  return result
}

async function listDirectory(_path: string): Promise<string> {
  try {
    const rootNode = await db
      .select()
      .from(fsNodes)
      .where(isNull(fsNodes.parentId))
      .limit(1)
      .then((rows) => rows[0])

    if (!rootNode) {
      return 'readme.txt  about.txt  projects/'
    }

    const children = await db.select().from(fsNodes).where(eq(fsNodes.parentId, rootNode.id))

    if (children.length === 0) {
      return '(empty directory)'
    }

    return children.map((n) => (n.type === 'dir' ? `${n.name}/` : n.name)).join('  ')
  } catch {
    return 'readme.txt  about.txt  projects/'
  }
}
