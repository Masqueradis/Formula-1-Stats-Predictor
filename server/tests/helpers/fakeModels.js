'use strict';

const { Op } = require('sequelize');

/**
 * In-memory фейк sequelize-модели для юнит-тестов sync-сервисов:
 * поддерживает ровно те операции, которые используются в f1SyncService
 * (findOne/create/update/destroy/bulkCreate/findOrCreate/max).
 */
function createFakeModel(initialRows = []) {
  const rows = [];
  let nextId = 1;

  function attach(row) {
    if (!row.update) {
      row.update = async (patch) => {
        Object.assign(row, patch);
        return row;
      };
    }
    return row;
  }

  function matches(row, where = {}) {
    return Object.entries(where).every(([k, v]) => {
      // Sequelize-оператор Op.in: { id: { [Op.in]: [1, 2] } }
      if (v && typeof v === 'object' && Array.isArray(v[Op.in])) {
        return v[Op.in].includes(row[k]);
      }
      return row[k] === v;
    });
  }

  const model = {
    rows,
    async findOne({ where } = {}) {
      const row = rows.find((r) => matches(r, where));
      return row ? attach(row) : null;
    },
    async findAll({ where } = {}) {
      return rows.filter((r) => matches(r, where)).map(attach);
    },
    async create(values) {
      const row = attach({ id: nextId++, ...values });
      rows.push(row);
      return row;
    },
    async update(values, { where } = {}) {
      const found = rows.filter((r) => matches(r, where));
      found.forEach((r) => Object.assign(r, values));
      return [found.length];
    },
    async destroy({ where } = {}) {
      let removed = 0;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (matches(rows[i], where)) {
          rows.splice(i, 1);
          removed += 1;
        }
      }
      return removed;
    },
    async bulkCreate(list) {
      const created = [];
      for (const values of list) created.push(await model.create(values));
      return created;
    },
    async findOrCreate({ where, defaults } = {}) {
      const row = rows.find((r) => matches(r, where));
      if (row) return [attach(row), false];
      return [await model.create(defaults || where), true];
    },
    async max(field) {
      const values = rows.map((r) => r[field]).filter((v) => v != null);
      return values.length ? Math.max(...values) : null;
    },
  };

  initialRows.forEach((r) => rows.push(attach(r)));
  return model;
}

module.exports = { createFakeModel };
