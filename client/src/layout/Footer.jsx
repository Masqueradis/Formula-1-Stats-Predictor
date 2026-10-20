export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border-soft py-6 text-center text-xs text-muted dark:border-border-dark dark:text-muted-dark">
      © {year} F1 Stats & Predictor — Simply Lovely
    </footer>
  )
}
