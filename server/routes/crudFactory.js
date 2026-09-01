const express = require('express');

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function buildCrudRouter({
  model,
  resource,
  includes = [],
  rejectUnknownFields = true,
  auth = [],
  sanitize,
}) {
  const router = express.Router();

  function applyIncludes(where, options = {}) {
    if (includes.length) {
      options.include = includes;
    }
    return { where, ...options };
  }

  function clean(record) {
    if (!sanitize) return record;
    if (Array.isArray(record)) return record.map((r) => sanitize(r));
    return sanitize(record);
  }

  function handleSequelizeError(err, res) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: `${resource} violates a unique constraint`,
        details: err.errors.map((e) => e.message),
      });
    }
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        error: 'Invalid data',
        details: err.message,
      });
    }
    return res.status(400).json({ error: 'Invalid data', details: err.message });
  }

  router.get('/', async (req, res) => {
    const records = await model.findAll(applyIncludes());
    res.json(clean(records));
  });

  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const record = await model.findByPk(id, applyIncludes());
    if (!record) {
      return res.status(404).json({ error: `Invalid id` });
    }
    res.json(clean(record));
  });

  router.post('/', auth, async (req, res) => {
    try {
      const record = await model.create(req.body, applyIncludes());
      res.status(201).json(clean(record));
    } catch (err) {
      return handleSequelizeError(err, res);
    }
  });

  router.put('/:id', auth, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    try {
      const record = await model.findByPk(id);
      if (!record) {
        return res.status(404).json({ error: `Invalid id` });
      }
      await record.update(req.body);
      const updated = await model.findByPk(id, applyIncludes());
      res.json(clean(updated));
    } catch (err) {
      return handleSequelizeError(err, res);
    }
  });

  router.delete('/:id', auth, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const deleted = await model.destroy({ where: { id } });
    if (!deleted) {
      return res.status(404).json({ error: `Invalid id` });
    }
    res.status(204).end();
  });

  return router;
}

module.exports = { buildCrudRouter, parseId };
