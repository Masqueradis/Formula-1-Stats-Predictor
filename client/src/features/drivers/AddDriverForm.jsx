import { useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { TEAM_NAMES } from './driversData'

const EMPTY = {
  firstName: '',
  lastName: '',
  abbreviation: '',
  number: '',
  team: 'Red Bull Racing',
  nationality: '',
  podiums: 0,
}

export default function AddDriverForm({ onAdd }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: name === 'abbreviation' ? value.toUpperCase() : value }))
    setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!form.firstName.trim() || !form.lastName.trim() || !form.nationality.trim()) {
      setError('Заполните имя, фамилию и национальность.')
      return
    }
    if (!/^[A-Z]{3}$/.test(form.abbreviation)) {
      setError('Аббревиатура — ровно 3 заглавные латинские буквы (например VER).')
      return
    }
    if (!form.number || Number(form.number) < 1) {
      setError('Введите корректный номер болида.')
      return
    }

    if (!onAdd({
      id: Date.now(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      abbreviation: form.abbreviation,
      number: Number(form.number),
      team: form.team,
      nationality: form.nationality.trim(),
      podiums: Number(form.podiums) || 0,
    })) {
      setError(`Пилот с аббревиатурой ${form.abbreviation} уже в списке.`)
      return
    }
    setForm(EMPTY)
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">Новый пилот</h2>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Имя" name="firstName" value={form.firstName} onChange={handleChange} />
        <Input label="Фамилия" name="lastName" value={form.lastName} onChange={handleChange} />
        <Input label="Аббревиатура (3 буквы)" name="abbreviation" value={form.abbreviation} onChange={handleChange} maxLength={3} />
        <Input label="Номер болида" type="number" name="number" value={form.number} onChange={handleChange} />
        <Input label="Национальность" name="nationality" value={form.nationality} onChange={handleChange} />
        <Input label="Подиумы" type="number" name="podiums" value={form.podiums} onChange={handleChange} min={0} />
        <div className="col-span-2">
          <Select label="Команда" name="team" value={form.team} onChange={handleChange}>
            {TEAM_NAMES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500" role="alert">
          {error}
        </p>
      )}

      <Button className="mt-4 w-full" onClick={handleSubmit}>Добавить пилота</Button>
    </Card>
  )
}
