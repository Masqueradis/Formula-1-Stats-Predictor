import useDocumentTitle from '../../hooks/useDocumentTitle'
import { useState } from 'react'
import api from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'

const FIELDS = [
  ['teams', 'Команды'],
  ['drivers', 'Пилоты'],
  ['races', 'Гонки'],
  ['results', 'Результаты'],
  ['seasonTeams', 'Составы'],
]

export default function AdminSync() {
  useDocumentTitle('Админ — Синхронизация')
  const [season, setSeason] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  const sync = async () => {
    setLoading(true)
    setError('')
    setSummary(null)
    try {
      const { data } = await api.post('/admin/sync', { season: Number(season) })
      setSummary(data.data)
    } catch (err) {
      setError(err.response?.data?.details || err.response?.data?.error || 'Не удалось синхронизировать данные')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">Синхронизация с Jolpica-F1</h2>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">
            Подтягивает команды, пилотов, календарь и результаты с внешнего API (api.jolpi.ca). Идемпотентно:
            повторный запуск обновляет существующие записи. Требует доступа в интернет.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Сезон"
            type="number"
            min={1950}
            max={2100}
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="w-32"
          />
          <Button onClick={sync} disabled={loading}>
            {loading ? 'Синхронизация…' : 'Синхронизировать'}
          </Button>
        </div>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}
      </Card>

      {summary && (
        <Card className="p-6">
          <h3 className="mb-3 font-bold text-foreground dark:text-foreground-dark">
            Готово — сезон {summary.season}
          </h3>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {FIELDS.map(([key, label]) => (
              <div key={key} className="rounded-lg bg-background p-3 text-center dark:bg-background-dark">
                <dt className="text-xs text-muted dark:text-muted-dark">{label}</dt>
                <dd className="text-xl font-bold text-foreground dark:text-foreground-dark">{summary[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
          {summary.errors?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-amber-500">Ошибки ({summary.errors.length}):</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-muted dark:text-muted-dark">
                {summary.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
