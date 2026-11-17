/**
 * База Socket.IO вычисляется из базы REST API.
 *
 * В проде `VITE_API_URL` — полный URL с суффиксом `/api`
 * (https://host/api). Socket.IO трактует путь из URL как namespace,
 * поэтому `/api` нужно снять: сервер слушает только namespace `/`.
 * В dev `VITE_API_URL='/api'` — результатом становится '' и клиент
 * подключается к тому же origin, что и страница.
 */
export function resolveSocketBaseUrl(apiUrl, explicitSocketUrl) {
  if (explicitSocketUrl) return explicitSocketUrl
  return String(apiUrl || '/api').replace(/\/api\/?$/, '')
}
