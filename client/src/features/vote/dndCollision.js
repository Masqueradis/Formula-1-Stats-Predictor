/**
 * BUG-05: стратегия коллизий для drag-and-drop в `/vote`.
 *
 * `pointerWithin` точно определяет явную зону «Вернуть в пул» и слоты под
 * курсором; `rectIntersection` и `closestCenter` остаются фолбэком для
 * клавиатуры и touch, когда указателя нет.
 */
export function createCollisionStrategy({ pointerWithin, rectIntersection, closestCenter }) {
  return function collisionDetectionStrategy(args) {
    const pointer = pointerWithin(args)
    if (pointer.length) return pointer
    const rect = rectIntersection(args)
    return rect.length ? rect : closestCenter(args)
  }
}
