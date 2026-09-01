const express = require('express');
const { drivers, generateId } = require('../data/store');

const router = express.Router();
const resource = 'driver';

const VALID_FIELDS = ['name', 'number', 'team', 'nationality', 'points'];

function validate(driver, { partial = false } = {}) {
  const errors = [];
  const present = Object.keys(driver).filter((k) => !VALID_FIELDS.includes(k));
  if (present.length) {
    errors.push(`Unknown field(s): ${present.join(', ')}`);
  }
  if (!partial || driver.name !== undefined) {
    if (typeof driver.name !== 'string' || !driver.name.trim()) {
      errors.push('"name" is required and must be a non-empty string');
    }
  }
  if (!partial || driver.number !== undefined) {
    if (!Number.isInteger(driver.number) || driver.number <= 0) {
      errors.push('"number" is required and must be a positive integer');
    }
  }
  return errors;
}

router.get('/', (req, res) => {
  res.json(drivers);
});

router.get('/:id', (req, res) => {
  const driver = drivers.find((d) => d.id === req.params.id);
  if (!driver) {
    return res.status(404).json({ error: `${resource} with id "${req.params.id}" not found` });
  }
  res.json(driver);
});

router.post('/', (req, res) => {
  const errors = validate(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid data', details: errors });
  }
  const driver = { id: generateId('d'), ...req.body };
  drivers.push(driver);
  res.status(201).json(driver);
});

router.put('/:id', (req, res) => {
  const driver = drivers.find((d) => d.id === req.params.id);
  if (!driver) {
    return res.status(404).json({ error: `${resource} with id "${req.params.id}" not found` });
  }
  const errors = validate(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid data', details: errors });
  }
  Object.assign(driver, req.body, { id: driver.id });
  res.json(driver);
});

router.delete('/:id', (req, res) => {
  const index = drivers.findIndex((d) => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: `${resource} with id "${req.params.id}" not found` });
  }
  drivers.splice(index, 1);
  res.status(204).end();
});

module.exports = router;
