import { desc } from 'drizzle-orm'
import { Hono } from 'hono'
import { Terminal } from '@/components/apps/Terminal'
import { sessionMiddleware } from '@/auth/middleware'
import { db } from '@/db/client'
import { terminalHistory } from '@/db/schema'
import { executeCommand } from '@/lib/shell'

const terminalApp = new Hono()

terminalApp.get('/', sessionMiddleware, async (c) => {
  const session = c.get('session')
  const username = session.role === 'owner' ? (process.env.OWNER_USERNAME ?? 'admin') : 'guest'

  const history = await db
    .select()
    .from(terminalHistory)
    .orderBy(desc(terminalHistory.ranAt))
    .limit(50)
    .then((rows) => rows.reverse())

  return c.html(
    <Terminal
      role={session.role}
      username={username}
      history={history.map((h) => ({ command: h.command, output: h.output ?? '' }))}
    />,
  )
})

terminalApp.post('/execute', sessionMiddleware, async (c) => {
  const session = c.get('session')
  const username = session.role === 'owner' ? (process.env.OWNER_USERNAME ?? 'admin') : 'guest'

  let body: { command?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request' }, 400)
  }

  const command = body.command ?? ''
  const result = await executeCommand(command, {
    role: session.role,
    username,
    cwd: '~',
  })

  return c.json(result)
})

export { terminalApp }
