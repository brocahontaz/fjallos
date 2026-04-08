import { db } from '@/db/client'
import { fsNodes } from '@/db/schema'
import { eq, isNull } from 'drizzle-orm'

export interface FsNode {
  id: number
  parentId: number | null
  name: string
  type: 'file' | 'dir'
  content: string | null
  createdAt: string | null
  updatedAt: string | null
}

export async function getRoot(): Promise<FsNode | null> {
  const result = await db.select().from(fsNodes).where(isNull(fsNodes.parentId)).limit(1)
  return (result[0] as FsNode) ?? null
}

/** Get or create the root directory node. */
export async function ensureRoot(): Promise<FsNode> {
  const existing = await getRoot()
  if (existing) return existing
  const rows = await db
    .insert(fsNodes)
    .values({ parentId: null, name: 'root', type: 'dir' })
    .returning()
  return rows[0] as FsNode
}

export async function getChildren(parentId: number): Promise<FsNode[]> {
  return db.select().from(fsNodes).where(eq(fsNodes.parentId, parentId)) as Promise<FsNode[]>
}

/**
 * Resolve a path against a cwd, handling `.`, `..`, `~`, and `/`.
 * All paths are internally represented as `~` or `~/segment/segment`.
 */
export function resolvePath(cwd: string, input: string): string {
  if (!input || input === '~') return '~'

  let base: string
  if (input.startsWith('~/') || input === '~') {
    base = input
  } else if (input.startsWith('/')) {
    base = `~${input}`
  } else {
    base = cwd === '~' ? `~/${input}` : `${cwd}/${input}`
  }

  // Normalize: handle . and ..
  const parts = base.split('/')
  const result: string[] = []
  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') {
      if (result.length > 1) result.pop() // never pop '~'
    } else {
      result.push(part)
    }
  }
  return result.join('/') || '~'
}

export async function getNodeByPath(path: string): Promise<FsNode | null> {
  const segments = path.replace(/^~\/?/, '').split('/').filter(Boolean)

  let current = await ensureRoot()

  for (const segment of segments) {
    const children = await getChildren(current.id)
    const match = children.find((c) => c.name === segment)
    if (!match) return null
    current = match
  }

  return current
}

export async function createNode(
  parentId: number,
  name: string,
  type: 'file' | 'dir',
  content?: string,
): Promise<FsNode> {
  const result = await db
    .insert(fsNodes)
    .values({ parentId, name, type, content: content ?? null })
    .returning()
  return result[0] as FsNode
}

export async function updateContent(id: number, content: string): Promise<void> {
  await db
    .update(fsNodes)
    .set({ content, updatedAt: new Date().toISOString() })
    .where(eq(fsNodes.id, id))
}

export async function deleteNode(id: number): Promise<void> {
  await db.delete(fsNodes).where(eq(fsNodes.id, id))
}
