import { useEffect } from 'react'

const BASE_TITLE = 'F1 Stats & Predictor'

/**
 * Заголовок вкладки браузера для страницы: «<title> — F1 Stats & Predictor».
 * Пустой title — только базовое имя. При размонтировании возвращается базовый,
 * чтобы переход между страницами всегда давал корректный итоговый заголовок.
 */
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE_TITLE}` : BASE_TITLE
    return () => {
      document.title = BASE_TITLE
    }
  }, [title])
}
