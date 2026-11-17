function prioritizePool(collisions) {
  const isPool = (collision) => (collision?.id ?? collision) === 'pool'
  const pool = collisions.find(isPool)
  return pool ? [pool, ...collisions.filter((collision) => !isPool(collision))] : collisions
}

export function createCollisionStrategy({ pointerWithin, rectIntersection, closestCenter }) {
  return function collisionDetectionStrategy(args) {
    const pointer = pointerWithin(args)
    if (pointer.length) {
      if (args?.active?.data?.current?.type === 'slot') return prioritizePool(pointer)
      return pointer
    }

    const rect = rectIntersection(args)
    if (rect.length) {
      if (args?.active?.data?.current?.type === 'slot') return prioritizePool(rect)
      return rect
    }

    return closestCenter(args)
  }
}
