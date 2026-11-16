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

test('BUG-05: без pointer-коллизий используется rectIntersection', () => {
  const strategy = makeStrategy({ pointer: [], rect: ['slot'], closest: ['slot'] })
  assert.deepEqual(strategy({}), ['slot'])
})

test('BUG-05: клавиатура/фолбэк — closestCenter', () => {
  const strategy = makeStrategy({ pointer: [], rect: [], closest: ['pool'] })
  assert.deepEqual(strategy({}), ['pool'])
})
