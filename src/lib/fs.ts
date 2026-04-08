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

export async function getChildren(parentId: number): Promise<FsNode[]> {
  return db.select().from(fsNodes).where(eq(fsNodes.parentId, parentId)) as Promise<FsNode[]>
}

export async function getNodeByPath(path: string): Promise<FsNode | null> {
  const parts = path.replace(/^\//, '').split('/').filter(Boolean)

  let current = await getRoot()
  if (!current) return null

  for (const part of parts) {
    if (part === '~') continue
    const children = await getChildren(current.id)
    const match = children.find((c) => c.name === part)
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
