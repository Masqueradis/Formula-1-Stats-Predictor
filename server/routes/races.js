const { buildCrudRouter } = require('./crudFactory');
const { Race } = require('../models');
const { authenticate } = require('../middleware/auth');

module.exports = buildCrudRouter({
  model: Race,
  resource: 'race',
  auth: [authenticate],
});
