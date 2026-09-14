function buildCrudRepository(model) {
  async function findAll(options = {}) {
    return model.findAll(options);
  }

  async function findById(id, options = {}) {
    return model.findByPk(id, options);
  }

  async function findOne(where, options = {}) {
    return model.findOne({ where, ...options });
  }

  async function create(data, options = {}) {
    return model.create(data, options);
  }

  async function update(id, data) {
    const record = await model.findByPk(id);
    if (!record) return null;
    await record.update(data);
    return record;
  }

  async function remove(id) {
    const deleted = await model.destroy({ where: { id } });
    return deleted > 0;
  }

  async function count(options = {}) {
    return model.count(options);
  }

  return { findAll, findById, findOne, create, update, remove, count };
}

module.exports = { buildCrudRepository };
