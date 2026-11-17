/**
 * Стратегия коллизий для drag-and-drop в `/vote` (BUG-05, регресс 18.11).
 *
 * `pointerWithin` точно определяет явную зону «Вернуть в пул» и слоты под
 * курсором; `rectIntersection` и `closestCenter` остаются фолбэком для
 * клавиатуры и touch, когда указателя нет. На тач-устройствах `closestCenter`
 * выбирал ближайший слот, поэтому для пилота со слота зона пула получает
 * приоритет среди всех пересекающихся droppable-зон.
 */
export function createCollisionStrategy({ pointerWithin, rectIntersection, closestCenter }) {
  return function collisionDetectionStrategy(args) {
    const pointer = pointerWithin(args)
    if (pointer.length) return pointer

    const rect = rectIntersection(args)
    if (rect.length) {
      const draggingSlot = args?.active?.data?.current?.type === 'slot'
      if (draggingSlot) {
        const isPool = (collision) => (collision?.id ?? collision) === 'pool'
        const pool = rect.find(isPool)
        if (pool) return [pool, ...rect.filter((collision) => !isPool(collision))]
      }
      return rect
    }

    return closestCenter(args)
  }
}
