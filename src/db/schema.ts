import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  role: text('role', { enum: ['owner', 'guest'] }).notNull(),
  csrfToken: text('csrf_token').notNull(),
  createdAt: text('created_at').default("(datetime('now'))"),
  expiresAt: text('expires_at').notNull(),
})

export const fsNodes = sqliteTable('fs_nodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  parentId: integer('parent_id'),
  name: text('name').notNull(),
  type: text('type', { enum: ['file', 'dir'] }).notNull(),
  content: text('content'),
  createdAt: text('created_at').default("(datetime('now'))"),
  updatedAt: text('updated_at').default("(datetime('now'))"),
})

export const windowLayouts = sqliteTable('window_layouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  app: text('app').notNull(),
  x: integer('x'),
  y: integer('y'),
  width: integer('width'),
  height: integer('height'),
  zIndex: integer('z_index'),
  minimised: integer('minimised').default(0),
})

export const terminalHistory = sqliteTable('terminal_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  command: text('command').notNull(),
  output: text('output'),
  exitCode: integer('exit_code'),
  ranAt: text('ran_at').default("(datetime('now'))"),
})
