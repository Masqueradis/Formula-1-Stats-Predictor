const express = require('express');
const { teams, generateId } = require('../data/store');

const router = express.Router();
const resource = 'team';

const VALID_FIELDS = ['name', 'principal', 'nationality', 'points'];

function validate(team, { partial = false } = {}) {
  const errors = [];
  const present = Object.keys(team).filter((k) => !VALID_FIELDS.includes(k));
  if (present.length) {
    errors.push(`Unknown field(s): ${present.join(', ')}`);
  }
  if (!partial || team.name !== undefined) {
    if (typeof team.name !== 'string' || !team.name.trim()) {
      errors.push('"name" is required and must be a non-empty string');
    }
  }
  return errors;
}

router.get('/', (req, res) => {
  res.json(teams);
});

router.get('/:id', (req, res) => {
  const team = teams.find((t) => t.id === req.params.id);
  if (!team) {
    return res.status(404).json({ error: `${resource} with id "${req.params.id}" not found` });
  }
  res.json(team);
});

router.post('/', (req, res) => {
  const errors = validate(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid data', details: errors });
  }
  const team = { id: generateId('t'), ...req.body };
  teams.push(team);
  res.status(201).json(team);
});

router.put('/:id', (req, res) => {
  const team = teams.find((t) => t.id === req.params.id);
  if (!team) {
    return res.status(404).json({ error: `${resource} with id "${req.params.id}" not found` });
  }
  const errors = validate(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid data', details: errors });
  }
  Object.assign(team, req.body, { id: team.id });
  res.json(team);
});

router.delete('/:id', (req, res) => {
  const index = teams.findIndex((t) => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: `${resource} with id "${req.params.id}" not found` });
  }
  teams.splice(index, 1);
  res.status(204).end();
});

module.exports = router;
