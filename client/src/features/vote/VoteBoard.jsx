import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../../api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

/** Перемешивание Фишера-Йейтса (для «Случайно») */
function shuffle(items) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Чип пилота в пуле: перетаскивается на слот или выбирается кликом */
function PoolChip({ entry, canAssign, onPick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `driver-${entry.driverId}`,
    data: { type: 'pool', driverId: entry.driverId },
    disabled: !canAssign,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      onClick={() => onPick(entry.driverId)}
      className={`flex items-center gap-3 rounded-lg border border-border-soft px-3 py-2 text-left text-sm transition-colors dark:border-border-dark ${
        canAssign
          ? 'cursor-grab hover:bg-background active:cursor-grabbing dark:hover:bg-background-dark'
          : 'cursor-default'
      } ${isDragging ? 'z-10 opacity-60 shadow-lg' : ''}`}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: eColor(entry) }} />
      <span className="font-mono font-black italic text-muted dark:text-muted-dark">{entry.abbreviation}</span>
      <span className="font-semibold text-foreground dark:text-foreground-dark">{entry.lastName}</span>
      <span className="truncate text-xs text-muted dark:text-muted-dark">{entry.teamName}</span>
    </div>
  )
}

/** Строка-слот (позиция 1..N): перетаскивается за «ручку» для смены мест, принимает пилота из пула */
function SlotRow({ index, entry, canEdit, onClear, isOver, dragType }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging, isSorting } = useSortable({
    id: `slot-${index}`,
    data: { type: 'slot', index },
  })
  const draggable = canEdit && Boolean(entry)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), zIndex: isDragging ? 10 : undefined }}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
        entry
          ? `border-border-soft dark:border-border-dark ${isDragging ? 'opacity-60 shadow-lg' : ''} ${
              isSorting ? 'transition-none' : ''
            } ${
              isOver
                ? 'border-primary bg-primary/10 ring-2 ring-primary dark:border-accent dark:bg-accent/10 dark:ring-accent'
                : ''
            }`
          : `border-dashed border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30 ${
              isOver ? 'border-solid ring-2 ring-primary bg-primary/10 dark:ring-accent dark:bg-accent/15' : ''
            }`
      }`}
    >
      <span className="w-6 shrink-0 text-center font-mono font-black text-muted dark:text-muted-dark">
        {index + 1}
      </span>
      {entry ? (
        <>
          <button
            ref={draggable ? setActivatorNodeRef : undefined}
            {...(draggable ? listeners : {})}
            {...(draggable ? attributes : {})}
            type="button"
            aria-label={`Перетащите, чтобы поменять позицию ${index + 1}`}
            disabled={!draggable}
            className={`shrink-0 rounded-md px-1 text-muted hover:text-foreground dark:text-muted-dark dark:hover:text-foreground-dark ${
              draggable ? 'cursor-grab active:cursor-grabbing' : 'opacity-30'
            }`}
          >
            ⠿
          </button>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: eColor(entry) }} />
          <span className="font-mono font-black italic text-muted dark:text-muted-dark">{entry.abbreviation}</span>
          <span className="font-semibold text-foreground dark:text-foreground-dark">{entry.lastName}</span>
          <span className="ml-auto flex items-center gap-2">
            {isOver && (
              <span className="text-xs font-semibold text-primary dark:text-accent">
                {dragType === 'pool' ? '→ заменит, прежний — в пул' : '⇄ поменяются местами'}
              </span>
            )}
            <button
              type="button"
              aria-label={`Убрать ${entry.lastName} с позиции ${index + 1}`}
              onClick={() => onClear(index)}
              disabled={!canEdit}
              className="rounded-md px-2 py-0.5 text-muted hover:bg-red-500 hover:text-white dark:text-muted-dark"
            >
              ×
            </button>
          </span>
        </>
      ) : (
        <span
          className={`text-xs font-medium ${isOver ? 'font-bold text-primary dark:text-accent' : 'text-red-500 dark:text-red-400'}`}
        >
          {isOver ? '→ сюда — отпустите' : 'пусто — перетащите или нажмите пилота'}
        </span>
      )}
    </div>
  )
}

function eColor(entry) {
  return entry.teamColor || '#0ea5e9'
}

export default function VoteBoard({ doc, user, onChanged }) {
  const toast = useToast()
  const entries = doc.entries || []
  const myVote = user ? (doc.votes || []).find((v) => Number(v.userId) === Number(user.id)) : null

  const [editing, setEditing] = useState(!myVote)
  const [slots, setSlots] = useState(() => entries.map(() => null)) // index+1 = позиция
  const [busy, setBusy] = useState(false)
  const [dragState, setDragState] = useState(null) // data.current активного элемента во время drag
  const [overId, setOverId] = useState(null) // id текущей зоны слёта (slot-N | pool | null)

  // Предзаполнение слотов из моего голоса / очистка
  useEffect(() => {
    const empty = entries.map(() => null)
    if (myVote) {
      for (const pick of myVote.picks || []) {
        if (pick.position >= 1 && pick.position <= empty.length) {
          empty[pick.position - 1] = pick.driverId
        }
      }
      setSlots(empty)
      setEditing(false)
    } else {
      setSlots(empty)
      setEditing(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.raceId, myVote?.createdAt])

  const assigned = useMemo(() => new Set(slots.filter(Boolean)), [slots])
  const pool = entries.filter((e) => !assigned.has(e.driverId))
  const emptySlots = slots.reduce((acc, v, i) => (v ? acc : [...acc, i]), [])
  const canEdit = editing && !busy && doc.votingOpen !== false

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const { setNodeRef: setPoolRef } = useDroppable({ id: 'pool' })

  const assignToFirstEmpty = (driverId) => {
    if (!canEdit) return
    setSlots((prev) => {
      const idx = prev.findIndex((v) => v === null)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = driverId
      return next
    })
  }

  const clearSlot = (index) => {
    if (!canEdit) return
    setSlots((prev) => {
      const next = [...prev]
      next[index] = null
      return next
    })
  }

  /** Подсветка зоны слёта: куда попадёт пилот при отпускании */
  const handleDragStart = ({ active }) => {
    setDragState({ ...active.data.current })
  }

  const handleDragOver = ({ over }) => {
    const id = over ? over.id : null
    setOverId((prev) => (prev === id ? prev : id)) // без перерисовок при повторении зоны
  }

  const handleDragCancel = () => {
    setDragState(null)
    setOverId(null)
  }

  /**
   * Итог перетаскивания (@dnd-kit):
   * - пул → слот k: пилот встаёт на место k (вытесненный возвращается в пул);
   * - слот i → слот j: позиции меняются местами (редактирование перетаскиванием);
   * - слот → пул: пилот убирается со слота в пул.
   */
  const handleDragEnd = ({ active, over }) => {
    setDragState(null)
    setOverId(null)
    if (!over || !canEdit) return
    const activeType = active.data.current?.type
    const overId = over.id

    if (activeType === 'pool') {
      if (typeof overId === 'string' && overId.startsWith('slot-')) {
        const target = Number(overId.slice(5))
        const driverId = active.data.current.driverId
        setSlots((prev) => {
          const next = [...prev]
          next[target] = driverId
          return next
        })
      }
      return
    }

    if (activeType === 'slot') {
      const from = active.data.current.index
      if (typeof overId === 'string' && overId.startsWith('slot-')) {
        const to = Number(overId.slice(5))
        if (from !== to) {
          setSlots((prev) => {
            const next = [...prev]
            ;[next[from], next[to]] = [next[to], next[from]]
            return next
          })
        }
      } else if (overId === 'pool') {
        clearSlot(from)
      }
    }
  }

  /** «Случайно» — заполняет ТОЛЬКО пустые слоты оставшимися пилотами */
  const fillEmptyRandomly = () => {
    if (!canEdit || emptySlots.length === 0) return
    const shuffledPool = shuffle(pool)
    setSlots((prev) => {
      const next = [...prev]
      let i = 0
      for (let s = 0; s < next.length; s += 1) {
        if (next[s] === null && i < shuffledPool.length) {
          next[s] = shuffledPool[i].driverId
          i += 1
        }
      }
      return next
    })
  }

  const clearAll = () => setSlots(entries.map(() => null))

  const submit = async () => {
    if (emptySlots.length > 0) {
      toast.error(`Заполните все слоты — пустых осталось: ${emptySlots.length}`)
      return
    }
    const picks = slots.map((driverId, i) => ({ driverId, position: i + 1 }))
    setBusy(true)
    try {
      const { data } = await api[methodFor(myVote)](
        `/predictions/race/${doc.raceId}/votes${myVote ? `/${user.id}` : ''}`,
        { kind: 'full', picks },
      )
      toast.success(myVote ? 'Прогноз обновлён' : 'Прогноз отправлен')
      setEditing(false)
      onChanged(data.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось сохранить прогноз')
    }
    setBusy(false)
  }

  const removeMyVote = async () => {
    setBusy(true)
    try {
      const { data } = await api.delete(`/predictions/race/${doc.raceId}/votes/${user.id}`)
      toast.success('Прогноз удалён')
      onChanged(data.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось удалить прогноз')
    }
    setBusy(false)
  }

  const entryById = useMemo(() => new Map(entries.map((e) => [e.driverId, e])), [entries])

  if (!doc.votingOpen) {
    return (
      <Card className="p-6">
        <h2 className="mb-2 text-lg font-bold text-foreground dark:text-foreground-dark">Мой прогноз</h2>
        <p className="text-sm text-muted dark:text-muted-dark">
          Голосование закрыто — уик-энд Гран-при начался. Ниже — итоговые результаты.
        </p>
        {myVote && <MyVoteSummary vote={myVote} entryById={entryById} />}
      </Card>
    )
  }

  if (!user) {
    return (
      <Card className="p-6">
        <h2 className="mb-2 text-lg font-bold text-foreground dark:text-foreground-dark">Мой прогноз</h2>
        <p className="text-sm text-muted dark:text-muted-dark">
          Прогноз можно оставить только вошедшему пользователю.{' '}
          <Link to="/login" className="font-semibold text-primary underline dark:text-accent">
            Войти
          </Link>
        </p>
      </Card>
    )
  }

  if (myVote && !editing) {
    return (
      <Card className="p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">Мой прогноз</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={busy}>
              Изменить
            </Button>
            <Button variant="danger" size="sm" onClick={removeMyVote} disabled={busy}>
              Удалить
            </Button>
          </div>
        </div>
        <MyVoteSummary vote={myVote} entryById={entryById} />
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">
          {myVote ? 'Изменение прогноза' : 'Мой прогноз на результаты'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fillEmptyRandomly} disabled={busy || emptySlots.length === 0}>
            Случайно ({emptySlots.length} пуст.)
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={busy}>
            Очистить
          </Button>
          {myVote && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>
              Отмена
            </Button>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted dark:text-muted-dark">
        Перетащите пилота из списка слева на нужное место (или просто нажмите на него — он займёт первое свободное
        слото). Порядок слотов меняется перетаскиванием за «⠿», пилот убирается обратно в список крестиком или
        переносом в колонку пилотов. «Случайно» заполняет только пустые слоты. Для отправки нужны все{' '}
        {entries.length} мест (перестановка 1..{entries.length}).
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Пул свободных пилотов (droppable: сюда можно вернуть пилота со слота) */}
          <div
            ref={setPoolRef}
            className={`rounded-lg ${
              overId === 'pool' && dragState?.type === 'slot'
                ? 'ring-2 ring-primary ring-offset-2 dark:ring-accent dark:ring-offset-background-dark'
                : ''
            }`}
          >
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted dark:text-muted-dark">
              Свободные пилоты ({pool.length})
            </h3>
            {overId === 'pool' && dragState?.type === 'slot' && (
              <p className="mb-2 text-xs font-semibold text-primary dark:text-accent">
                Отпустите здесь — пилот вернётся в список
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {pool.map((e) => (
                <PoolChip key={e.driverId} entry={e} canAssign={canEdit && emptySlots.length > 0} onPick={assignToFirstEmpty} />
              ))}
              {pool.length === 0 && (
                <p className="text-sm text-muted dark:text-muted-dark">Все пилоты расставлены ✓</p>
              )}
            </div>
          </div>

          {/* Слоты позиций 1..N */}
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted dark:text-muted-dark">
              Слоты мест (1..{entries.length}) — заполнено {entries.length - emptySlots.length}/{entries.length}
            </h3>
            <SortableContext items={slots.map((_, i) => `slot-${i}`)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {slots.map((driverId, index) => (
                  <SlotRow
                    key={index}
                    index={index}
                    entry={driverId ? entryById.get(driverId) : null}
                    canEdit={canEdit}
                    onClear={clearSlot}
                    isOver={overId === `slot-${index}`}
                    dragType={dragState?.type}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        </div>
      </DndContext>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={submit} disabled={busy || emptySlots.length > 0}>
          {busy ? 'Сохранение…' : myVote ? 'Сохранить изменения' : 'Отправить прогноз'}
        </Button>
        {emptySlots.length > 0 && (
          <span className="text-sm font-medium text-red-500 dark:text-red-400">
            Пустых слотов: {emptySlots.length}
          </span>
        )}
      </div>
    </Card>
  )
}

function methodFor(myVote) {
  return myVote ? 'put' : 'post'
}

function MyVoteSummary({ vote, entryById }) {
  const top3 = [...(vote.picks || [])]
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
  return (
    <ol className="flex flex-wrap gap-2">
      {top3.map((p) => {
        const e = entryById.get(p.driverId)
        return (
          <li
            key={p.driverId}
            className="flex items-center gap-2 rounded-lg border border-border-soft px-3 py-1.5 text-sm dark:border-border-dark"
          >
            <span className="font-mono font-black text-primary dark:text-accent">{p.position}</span>
            <span className="font-mono font-black italic text-muted dark:text-muted-dark">{e?.abbreviation || '?'}</span>
            <span className="font-semibold text-foreground dark:text-foreground-dark">{e?.lastName || '#' + p.driverId}</span>
          </li>
        )
      })}
      <li className="flex items-center px-2 text-xs text-muted dark:text-muted-dark">
        и ещё {(vote.picks || []).length - top3.length} пилотов
      </li>
    </ol>
  )
}
