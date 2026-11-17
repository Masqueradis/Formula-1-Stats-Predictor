export function valueFor(row, key) {
  if (!row) return ''
  if (key === 'driver') return `${row.lastName || ''} ${row.firstName || ''}`.toLowerCase()
  if (key === 'team') return (row.team?.name || row.name || '').toLowerCase()
  return Number(row[key]) || 0
}

export const NUMERIC_KEYS = ['position', 'points', 'wins', 'podiums']
