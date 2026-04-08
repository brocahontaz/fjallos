import { csrfMiddleware, sessionMiddleware } from '@/auth/middleware'
import { Terminal } from '@/components/apps/Terminal'
import { db } from '@/db/client'
import { terminalHistory } from '@/db/schema'
import { ansiToHtml } from '@/lib/ansi'
import { executeCommand } from '@/lib/shell'
import { desc } from 'drizzle-orm'
import { Hono } from 'hono'

const terminalApp = new Hono()

terminalApp.get('/', sessionMiddleware, async (c) => {
  const session = c.get('session')
  const username = session.role === 'owner' ? (process.env.OWNER_USERNAME ?? 'admin') : 'guest'

  // Only load history for owner
  const history =
    session.role === 'owner'
      ? await db
          .select()
          .from(terminalHistory)
          .orderBy(desc(terminalHistory.ranAt))
          .limit(50)
          .then((rows) => rows.reverse())
      : []

  return c.html(
    <Terminal
      role={session.role}
      username={username}
      history={history.map((h) => ({ command: h.command, output: ansiToHtml(h.output ?? '') }))}
    />,
  )
})

terminalApp.post('/execute', sessionMiddleware, csrfMiddleware, async (c) => {
  const session = c.get('session')
  const username = session.role === 'owner' ? (process.env.OWNER_USERNAME ?? 'admin') : 'guest'

  let body: { command?: string; cwd?: string; mode?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request' }, 400)
  }

  const command = body.command ?? ''
  const cwd = body.cwd ?? '~'
  const mode = (body.mode ?? 'tty') as 'tty' | 'gui'

  const result = await executeCommand(command, {
    role: session.role,
    username,
    cwd,
    mode,
  })

  // Only persist history for owner
  if (session.role === 'owner' && command.trim()) {
    try {
      await db.insert(terminalHistory).values({
        command: command.trim(),
        output: result.output,
        exitCode: result.exitCode,
      })
    } catch {
      // non-fatal
    }
  }

  const htmlOutput = ansiToHtml(result.output)

  // Stream output as SSE so clients can render incrementally
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      if (htmlOutput) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ html: htmlOutput })}\n\n`))
      }
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            done: true,
            action: result.action ?? null,
            themeValue: result.themeValue ?? null,
            newCwd: result.newCwd ?? null,
            exitCode: result.exitCode,
          })}\n\n`,
        ),
      )
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
})

export { terminalApp }
