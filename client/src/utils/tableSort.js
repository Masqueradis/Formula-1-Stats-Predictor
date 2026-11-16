/**
 * BUG-09: значение ячейки для сортировки таблиц зачётов.
 *
 * В личном зачёте команда лежит в `row.team.name`, в Кубке конструкторов —
 * в `row.name`. Раньше для обоих случаев читался `row.name`, поэтому
 * сортировка пилотов по команде не работала.
 */
export function valueFor(row, key) {
  if (!row) return ''
  if (key === 'driver') return `${row.lastName || ''} ${row.firstName || ''}`.toLowerCase()
  if (key === 'team') return (row.team?.name || row.name || '').toLowerCase()
  return Number(row[key]) || 0
}

export const NUMERIC_KEYS = ['position', 'points', 'wins', 'podiums']
