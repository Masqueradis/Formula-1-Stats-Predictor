const crypto = require('crypto');

const drivers = [
  {
    id: 'd1',
    name: 'Max Verstappen',
    number: 1,
    team: 'Red Bull Racing',
    nationality: 'Netherlands',
    points: 437,
  },
  {
    id: 'd2',
    name: 'Lewis Hamilton',
    number: 44,
    team: 'Mercedes',
    nationality: 'United Kingdom',
    points: 312,
  },
  {
    id: 'd3',
    name: 'Charles Leclerc',
    number: 16,
    team: 'Ferrari',
    nationality: 'Monaco',
    points: 289,
  },
];

const teams = [
  {
    id: 't1',
    name: 'Red Bull Racing',
    principal: 'Christian Horner',
    nationality: 'Austria',
    points: 791,
  },
  {
    id: 't2',
    name: 'Ferrari',
    principal: 'Frédéric Vasseur',
    nationality: 'Italy',
    points: 674,
  },
  {
    id: 't3',
    name: 'Mercedes',
    principal: 'Toto Wolff',
    nationality: 'Germany',
    points: 512,
  },
];

const races = [
  {
    id: 'r1',
    name: 'Bahrain Grand Prix',
    circuit: 'Bahrain International Circuit',
    date: '2026-04-05',
    season: 2026,
  },
  {
    id: 'r2',
    name: 'Saudi Arabian Grand Prix',
    circuit: 'Jeddah Corniche Circuit',
    date: '2026-04-19',
    season: 2026,
  },
  {
    id: 'r3',
    name: 'Japanese Grand Prix',
    circuit: 'Suzuka International Racing Course',
    date: '2026-05-03',
    season: 2026,
  },
];

function generateId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

module.exports = { drivers, teams, races, generateId };
