const apiResponse = require('../utils/apiResponse');

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function buildCrudService({
  repository,
  resource,
  includes = [],
  sanitize,
}) {
  function applyIncludes(options = {}) {
    if (includes.length) {
      options.include = includes;
    }
    return options;
  }

  function clean(record) {
    if (!sanitize) return record;
    if (Array.isArray(record)) return record.map((r) => sanitize(r));
    return sanitize(record);
  }

  async function getAll() {
    const records = await repository.findAll(applyIncludes());
    return clean(records);
  }

  async function getById(rawId) {
    const id = parseId(rawId);
    if (id === null) return { error: 'Invalid id' };
    const record = await repository.findById(id, applyIncludes());
    if (!record) return { error: `${resource} not found`, status: 404 };
    return clean(record);
  }

  async function create(data) {
    const record = await repository.create(data, applyIncludes());
    return clean(record);
  }

  async function update(rawId, data) {
    const id = parseId(rawId);
    if (id === null) return { error: 'Invalid id' };
    const updated = await repository.update(id, data);
    if (!updated) return { error: `${resource} not found`, status: 404 };
    const record = await repository.findById(id, applyIncludes());
    return clean(record);
  }

  async function remove(rawId) {
    const id = parseId(rawId);
    if (id === null) return { error: 'Invalid id' };
    const deleted = await repository.remove(id);
    if (!deleted) return { error: `${resource} not found`, status: 404 };
    return true;
  }

  return { getAll, getById, create, update, remove, parseId };
}

module.exports = { buildCrudService, parseId };
