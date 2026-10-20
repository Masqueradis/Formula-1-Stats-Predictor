import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

const SORT_FIELDS = [
  { key: 'lastName', label: 'Фамилия' },
  { key: 'number', label: 'Номер' },
  { key: 'podiums', label: 'Подиумы' },
]

export default function SearchFilter({ search, onSearch, team, onTeam, sortField, onSortField, sortOrder, onSortOrder, teams = [] }) {
  return (
    <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        label="Поиск"
        type="search"
        placeholder="Имя, аббр.…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="sm:col-span-2 lg:col-span-1"
      />

      <Select label="Команда" value={team} onChange={(e) => onTeam(e.target.value)}>
        <option value="">Все команды</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </Select>

      <Select label="Сортировка" value={sortField} onChange={(e) => onSortField(e.target.value)}>
        {SORT_FIELDS.map((f) => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </Select>

      <div className="flex flex-col justify-end">
        <Button variant="outline" onClick={() => onSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
          Порядок: {sortOrder === 'asc' ? '↑ по возр.' : '↓ по убыв.'}
        </Button>
      </div>
    </Card>
  )
}