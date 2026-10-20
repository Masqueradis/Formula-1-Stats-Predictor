import { useState } from 'react'
import api from '../../api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'

export default function VotersSummary({ doc, user, stats, onChanged }) {
  const toast = useToast()
  const [pendingDelete, setPendingDelete] = useState(null) // userId чужого/своего голоса
  const [busy, setBusy] = useState(false)

  const votes = [...(doc.votes || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const entryById = new Map((doc.entries || []).map((e) => [e.driverId, e]))

  const canDelete = (vote) => user && (Number(vote.userId) === Number(user.id) || user.role === 'ADMIN')

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusy(true)
    try {
      const { data } = await api.delete(`/predictions/race/${doc.raceId}/votes/${pendingDelete}`)
      toast.success('Прогноз удалён')
      onChanged(data.data)
      setPendingDelete(null)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось удалить прогноз')
    }
    setBusy(false)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Народный рейтинг (aggregation) */}
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-bold text-foreground dark:text-foreground-dark">Народный рейтинг</h2>
        <p className="mb-3 text-sm text-muted dark:text-muted-dark">
          Среднее ожидаемое место по всем голосам (aggregation pipeline в MongoDB).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left text-xs uppercase text-muted dark:border-border-dark dark:text-muted-dark">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Пилот</th>
                <th className="py-2 pr-2">Ср. место</th>
                <th className="py-2 pr-2">Лучш.</th>
                <th className="py-2 pr-2">Худш.</th>
                <th className="py-2">Голосов</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.driverId} className="border-b border-border-soft last:border-0 dark:border-border-dark">
                  <td className="py-2 pr-2 font-mono font-bold text-muted dark:text-muted-dark">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.driver?.teamColor || '#0ea5e9' }} />
                      <span className="font-mono font-black italic text-muted dark:text-muted-dark">{s.driver?.abbreviation}</span>
                      <span className="font-semibold text-foreground dark:text-foreground-dark">{s.driver?.lastName}</span>
                    </span>
                  </td>
                  <td className="py-2 pr-2 font-bold text-foreground dark:text-foreground-dark">
                    {s.avgPosition ?? '—'}
                  </td>
                  <td className="py-2 pr-2 text-muted dark:text-muted-dark">{s.bestPosition ?? '—'}</td>
                  <td className="py-2 pr-2 text-muted dark:text-muted-dark">{s.worstPosition ?? '—'}</td>
                  <td className="py-2 text-muted dark:text-muted-dark">{s.votesCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Кто голосовал */}
      <Card className="p-6">
        <h2 className="mb-3 text-lg font-bold text-foreground dark:text-foreground-dark">
          Проголосовали <span className="text-sm font-normal text-muted dark:text-muted-dark">({votes.length})</span>
        </h2>
        {votes.length === 0 ? (
          <p className="text-sm text-muted dark:text-muted-dark">Пока нет ни одного голоса — будьте первым!</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {votes.map((v) => {
              const top3 = [...(v.picks || [])].sort((a, b) => a.position - b.position).slice(0, 3)
              const isMine = user && Number(v.userId) === Number(user.id)
              return (
                <li
                  key={v.userId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border-soft px-3 py-2 dark:border-border-dark"
                >
                  <span className={`text-sm font-bold ${isMine ? 'text-primary dark:text-accent' : 'text-foreground dark:text-foreground-dark'}`}>
                    {v.username}
                  </span>
                  {isMine && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary dark:bg-accent/20 dark:text-accent">
                      вы
                    </span>
                  )}
                  <span className="flex gap-1.5">
                    {top3.map((p) => (
                      <span
                        key={p.driverId}
                        className="rounded bg-background px-1.5 py-0.5 text-xs dark:bg-background-dark"
                        title={entryById.get(p.driverId)?.lastName}
                      >
                        <span className="font-mono font-bold text-foreground dark:text-foreground-dark">{p.position}</span>
                        <span className="font-mono font-black italic text-muted dark:text-muted-dark">
                          {' '}{entryById.get(p.driverId)?.abbreviation || '?'}
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className="ml-auto text-xs text-muted dark:text-muted-dark">
                    {new Date(v.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {canDelete(v) && (
                    <Button variant="ghost" size="xs" onClick={() => setPendingDelete(v.userId)} disabled={busy}>
                      Удалить
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Удалить прогноз?"
        message="Прогноз будет удалён без возможности восстановления (до старта гонки можно проголосовать заново)."
        confirmLabel="Удалить"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
