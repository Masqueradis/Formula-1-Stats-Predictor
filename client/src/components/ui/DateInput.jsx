import { useEffect, useState } from 'react'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function isoToDisplay(iso) {
  const value = String(iso || '').trim()
  if (!ISO_RE.test(value)) return ''
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`
}

function isValidIso(iso) {
  if (!ISO_RE.test(iso)) return false
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  )
}

function maskDisplay(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join('.')
}

function displayToIso(display) {
  const digits = String(display || '').replace(/\D/g, '')
  if (digits.length !== 8) return null
  const iso = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`
  return isValidIso(iso) ? iso : null
}

export default function DateInput({
  label,
  value = '',
  onChange,
  name,
  id,
  className = '',
  placeholder = 'дд.мм.гггг',
  disabled = false,
  required = false,
  ...props
}) {
  const [text, setText] = useState(() => isoToDisplay(value))
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setText(isoToDisplay(value))
    setInvalid(false)
  }, [value])

  const emit = (iso) => {
    onChange?.({ target: { value: iso, name } })
  }

  const handleChange = (event) => {
    const masked = maskDisplay(event.target.value)
    setText(masked)

    const iso = displayToIso(masked)
    if (iso) {
      setInvalid(false)
      emit(iso)
      return
    }

    const complete = masked.replace(/\D/g, '').length === 8
    setInvalid(complete)
    if (value) emit('')
  }

  const handleBlur = () => {
    if (!text) return
    if (displayToIso(text)) return
    setText(isoToDisplay(value))
    setInvalid(false)
  }

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted dark:text-muted-dark">
      {label}
      <input
        {...props}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        required={required}
        aria-invalid={invalid || undefined}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary dark:bg-background-dark dark:text-foreground-dark dark:focus:border-accent ${
          invalid
            ? 'border-red-500 dark:border-red-500'
            : 'border-border-soft dark:border-border-dark'
        } ${className}`}
      />
      {invalid && (
        <span className="text-[11px] font-normal text-red-500">
          Дата в формате дд.мм.гггг
        </span>
      )}
    </label>
  )
}
