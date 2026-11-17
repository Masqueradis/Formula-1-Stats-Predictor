import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSocketBaseUrl } from '../src/utils/socketUrl.js'

test('dev: относительный /api даёт пустую базу (тот же origin)', () => {
  assert.equal(resolveSocketBaseUrl('/api', undefined), '')
  assert.equal(resolveSocketBaseUrl('/api/', undefined), '')
})

test('prod: суффикс /api снимается с полного URL', () => {
  // Не вставляем сюда боевой адрес: Netlify Secret Scanning считает значение
  // VITE_API_URL секретом и роняет сборку при совпадении строки в репозитории.
  assert.equal(
    resolveSocketBaseUrl('https://api.example.com/api', undefined),
    'https://api.example.com',
  )
  assert.equal(
    resolveSocketBaseUrl('https://api.example.com/api/', undefined),
    'https://api.example.com',
  )
})

test('явный VITE_SOCKET_URL имеет приоритет', () => {
  assert.equal(
    resolveSocketBaseUrl('https://api.example.com/api', 'wss://socket.example.com'),
    'wss://socket.example.com',
  )
})

test('URL без суффикса /api не меняется', () => {
  assert.equal(resolveSocketBaseUrl('https://api.example.com', undefined), 'https://api.example.com')
})
