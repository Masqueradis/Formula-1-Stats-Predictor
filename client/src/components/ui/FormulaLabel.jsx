/**
 * Подстрочный индекс для формул (эпик-10).
 * Используем нативный <sub>, чтобы не тянуть KaTeX ради одной строки.
 */
export default function FormulaLabel({ base, sub, className = '' }) {
  return (
    <span className={className}>
      {base}
      <sub className="text-[0.65em] font-medium leading-none">{sub}</sub>
    </span>
  )
}
