export default function Badge({ children, color, className = '' }) {
  const style = color
    ? { backgroundColor: `${color}22`, color }
    : {}

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      style={style}
    >
      {children}
    </span>
  )
}
