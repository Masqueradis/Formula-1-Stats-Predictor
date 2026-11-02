/**
 * Эпик-10: подстрочные индексы формулы на нативном <sub> (без KaTeX).
 * Пример: <FormulaLabel base="P" sub="qual" /> → P_qual с настоящим подстрочником.
 */
export default function FormulaLabel({ base, sub, className = '' }) {
  return (
    <span className={className}>
      {base}
      {sub ? <sub className="text-[0.72em] font-normal">{sub}</sub> : null}
    </span>
  )
}
