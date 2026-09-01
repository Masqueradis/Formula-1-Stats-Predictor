const express = require('express');
const { races, generateId } = require('../data/store');

const router = express.Router();
const resource = 'race';

const VALID_FIELDS = ['name', 'circuit', 'date', 'season'];

function validate(race, { partial = false } = {}) {
  const errors = [];
  const present = Object.keys(race).filter((k) => !VALID_FIELDS.includes(k));
  if (present.length) {
    errors.push(`Unknown field(s): ${present.join(', ')}`);
  }
  if (!partial || race.name !== undefined) {
    if (typeof race.name !== 'string' || !race.name.trim()) {
      errors.push('"name" is required and must be a non-empty string');
    }
  }
  if (!partial || race.season !== undefined) {
    if (!Number.isInteger(race.season) || race.season < 1950) {
      errors.push('"season" is required and must be an integer >= 1950');
    }
  }
  return errors;
}

router.get('/', (req, res) => {
  res.json(races);
});

router.get('/:id', (req, res) => {
  const race = races.find((r) => r.id === req.params.id);
  if (!race) {
    return res.status(404).json({ error: `${resource} with id "${req.params.id}" not found` });
  }
  res.json(race);
});

router.post('/', (req, res) => {
  const errors = validate(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid data', details: errors });
  }
  const race = { id: generateId('r'), ...req.body };
  races.push(race);
  res.status(201).json(race);
});

router.put('/:id', (req, res) => {
  const race = races.find((r) => r.id === req.params.id);
  if (!race) {
    return res.status(404).json({ error: `${resource} with id "${req.params.id}" not found` });
  }
  const errors = validate(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid data', details: errors });
  }
  Object.assign(race, req.body, { id: race.id });
  res.json(race);
});

router.delete('/:id', (req, res) => {
  const index = races.findIndex((r) => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: `${resource} with id "${req.params.id}" not found` });
  }
  races.splice(index, 1);
  res.status(204).end();
});

module.exports = router;
