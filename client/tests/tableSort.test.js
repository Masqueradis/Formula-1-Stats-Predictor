import test from 'node:test'
import assert from 'node:assert/strict'
import { valueFor, NUMERIC_KEYS } from '../src/utils/tableSort.js'

test('BUG-09: команда пилота берётся из row.team.name', () => {
  const row = { team: { name: 'Ferrari' }, name: 'Scuderia Ferrari' }
  assert.equal(valueFor(row, 'team'), 'ferrari')
})

test('BUG-09: в Кубке конструкторов название берётся из row.name', () => {
  assert.equal(valueFor({ name: 'McLaren' }, 'team'), 'mclaren')
})

test('BUG-09: отсутствующая команда не ломает сортировку', () => {
  assert.equal(valueFor({}, 'team'), '')
  assert.equal(valueFor(null, 'team'), '')
})

test('пилот сортируется по фамилии, затем имени', () => {
  assert.equal(valueFor({ lastName: 'Verstappen', firstName: 'Max' }, 'driver'), 'verstappen max')
})

test('числовые ключи приводятся к числу', () => {
  assert.equal(valueFor({ points: '385' }, 'points'), 385)
  assert.equal(valueFor({}, 'points'), 0)
  assert.deepEqual(NUMERIC_KEYS.includes('points'), true)
})
