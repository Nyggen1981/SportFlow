import { prisma } from "@/lib/prisma"

/**
 * Given a partId and its resourceId, return every part ID that conflicts
 * with it: the part itself, all ancestors up to the root, and all
 * descendants down to the leaves.  A single DB query fetches every part
 * for the resource; the tree walk happens in memory.
 */
export async function getAllRelatedPartIds(
  partId: string,
  resourceId: string
): Promise<string[]> {
  const allParts = await prisma.resourcePart.findMany({
    where: { resourceId },
    select: { id: true, parentId: true },
  })

  const result = new Set<string>([partId])

  // Walk up to root
  let currentId: string | null = partId
  while (currentId) {
    const part = allParts.find((p) => p.id === currentId)
    if (part?.parentId) {
      result.add(part.parentId)
      currentId = part.parentId
    } else {
      break
    }
  }

  // Walk down all descendants (BFS)
  const queue = [partId]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const part of allParts) {
      if (part.parentId === id && !result.has(part.id)) {
        result.add(part.id)
        queue.push(part.id)
      }
    }
  }

  return [...result]
}
