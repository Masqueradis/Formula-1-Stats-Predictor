/**
 * Стратегия коллизий для drag-and-drop в `/vote` (BUG-05, регресс 18.11).
 *
 * `pointerWithin` точно определяет явную зону «Вернуть в пул» и слоты под
 * курсором; `rectIntersection` и `closestCenter` остаются фолбэком для
 * клавиатуры и touch, когда указателя нет. Для пилота со слота зона пула
 * получает приоритет среди всех пересекающихся droppable-зон: тач-фолбэк
 * `closestCenter` иначе выбирал ближайший слот.
 *
 * Важно: хук `useDroppable` зоны пула должен вызываться внутри `DndContext`
 * (компонент `PoolColumn`). Вне провайдера dnd-kit использует noop-dispatch,
 * и зона не регистрируется — тогда `pointer` всегда пуст и возврат не работает.
 */
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
