'use strict';

/**
 * In-memory фейк sequelize-модели для юнит-тестов sync-сервисов:
 * поддерживает ровно те операции, которые используются в f1SyncService
 * (findOne/create/update/destroy/bulkCreate/findOrCreate).
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
    return Object.entries(where).every(([k, v]) => row[k] === v);
  }

  const model = {
    rows,
    async findOne({ where } = {}) {
      const row = rows.find((r) => matches(r, where));
      return row ? attach(row) : null;
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
  };

  initialRows.forEach((r) => rows.push(attach(r)));
  return model;
}

module.exports = { createFakeModel };
