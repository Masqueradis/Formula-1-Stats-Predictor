export default function FormulaLabel({ base, sub, className = '' }) {
  return (
    <span className={className}>
      {base}
      {sub ? <sub className="text-[0.72em] font-normal">{sub}</sub> : null}
    </span>
  )
}
