export function resolveSocketBaseUrl(apiUrl, explicitSocketUrl) {
  if (explicitSocketUrl) return explicitSocketUrl
  return String(apiUrl || '/api').replace(/\/api\/?$/, '')
}
