import { useState } from 'react'
import { teamColor, TEAM_NAMES } from './driversData'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

export default function DriverCard({ driver, isEditing, onStartEdit, onCancelEdit, onSaveEdit, onDelete }) {
  const [imgFailed, setImgFailed] = useState(false)

  const [form, setForm] = useState({
    firstName: driver.firstName,
    lastName: driver.lastName,
    abbreviation: driver.abbreviation,
    number: driver.number,
    team: driver.team,
    nationality: driver.nationality,
  })

  const color = teamColor(driver.team)
  const showPhoto = driver.photo && !imgFailed

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: name === 'abbreviation' ? value.toUpperCase() : value }))
  }

  if (isEditing) {
    return (
      <Card className="flex h-full flex-col p-4 sm:p-5">
        <p className="mb-3 text-sm font-bold text-primary dark:text-accent">Редактирование</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Имя" name="firstName" value={form.firstName} onChange={handleChange} />
          <Input label="Фамилия" name="lastName" value={form.lastName} onChange={handleChange} />
          <Input label="Аббр. (3)" name="abbreviation" value={form.abbreviation} onChange={handleChange} maxLength={3} />
          <Input label="Номер" type="number" name="number" value={form.number} onChange={handleChange} />
          <Input label="Национальность" name="nationality" value={form.nationality} onChange={handleChange} />
          <div className="col-span-2">
            <Select label="Команда" name="team" value={form.team} onChange={handleChange}>
              <option value="">— выберите —</option>
              {TEAM_NAMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => onSaveEdit(driver.id, form)}>Сохранить</Button>
          <Button size="sm" variant="outline" onClick={onCancelEdit}>Отмена</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative h-40 shrink-0 w-full">
        {showPhoto ? (
          <img
            src={driver.photo}
            alt={`${driver.firstName} ${driver.lastName}`}
            loading="lazy"
            className="h-full w-full object-cover object-top"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundImage: `linear-gradient(135deg, ${color}, #0f172a)` }}
          >
            <span className="font-mono text-4xl font-black italic tracking-wider text-white/90">{driver.abbreviation}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="absolute bottom-2 left-4 text-3xl font-black italic tracking-wider text-white drop-shadow">
          {driver.abbreviation}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-2 break-words text-lg font-bold leading-snug text-foreground dark:text-foreground-dark">
          {driver.firstName} {driver.lastName}
        </h3>
        <p className="mt-0.5 text-sm text-muted dark:text-muted-dark">
          {driver.nationality} · №{driver.number}
        </p>

        <div className="mt-3 flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted dark:text-muted-dark">
            {driver.team}
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-5">
          <Button variant="outline" size="xs" className="w-full" onClick={() => onStartEdit(driver.id)}>
            Редактировать
          </Button>
          <Button variant="danger" size="xs" className="w-full" onClick={() => onDelete(driver.id)}>
            Удалить
          </Button>
        </div>
      </div>
    </Card>
  )
}