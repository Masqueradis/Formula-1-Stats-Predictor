import test from 'node:test'
import assert from 'node:assert/strict'
import { createCollisionStrategy } from '../src/features/vote/dndCollision.js'

function makeStrategy({ pointer = [], rect = [], closest = ['closest'] }) {
  return createCollisionStrategy({
    pointerWithin: () => pointer,
    rectIntersection: () => rect,
    closestCenter: () => closest,
  })
}

test('BUG-05: приоритет у pointerWithin (точная зона пула/слота)', () => {
  const strategy = makeStrategy({ pointer: ['pool'], rect: ['slot'], closest: ['slot'] })
  assert.deepEqual(strategy({}), ['pool'])
})

test('BUG-05: пилот со слота возвращается в пул даже при pointer-коллизии со слотом', () => {
  const strategy = makeStrategy({ pointer: ['slot-0', 'pool'] })
  const result = strategy({ active: { data: { current: { type: 'slot' } } } })
  assert.deepEqual(result, ['pool', 'slot-0'])
})

test('BUG-05: без pointer-коллизий используется rectIntersection', () => {
  const strategy = makeStrategy({ pointer: [], rect: ['slot'], closest: ['slot'] })
  assert.deepEqual(strategy({}), ['slot'])
})

test('BUG-05: тач — зона пула выигрывает у слота при пересечении', () => {
  const strategy = makeStrategy({ pointer: [], rect: ['slot-3', 'pool'], closest: ['slot-3'] })
  const result = strategy({ active: { data: { current: { type: 'slot' } } } })
  assert.deepEqual(result, ['pool', 'slot-3'])
})

test('BUG-05: тач — пилот из пула не вытесняет слот через приоритет пула', () => {
  const strategy = makeStrategy({ pointer: [], rect: ['slot-3', 'pool'], closest: ['slot-3'] })
  const result = strategy({ active: { data: { current: { type: 'pool' } } } })
  assert.deepEqual(result, ['slot-3', 'pool'])
})

test('BUG-05: клавиатура/фолбэк — closestCenter', () => {
  const strategy = makeStrategy({ pointer: [], rect: [], closest: ['pool'] })
  assert.deepEqual(strategy({}), ['pool'])
})
