export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`rounded-xl border border-border-soft bg-card shadow-sm transition-colors dark:border-border-dark dark:bg-card-dark ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
