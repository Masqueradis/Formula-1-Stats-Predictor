'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('drivers', 'externalId', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('teams', 'externalId', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('races', 'externalId', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addIndex('drivers', ['externalId'], {
      unique: true,
      name: 'drivers_external_id_unique',
    });
    await queryInterface.addIndex('teams', ['externalId'], {
      unique: true,
      name: 'teams_external_id_unique',
    });
    await queryInterface.addIndex('races', ['externalId'], {
      unique: true,
      name: 'races_external_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('races', 'races_external_id_unique');
    await queryInterface.removeIndex('teams', 'teams_external_id_unique');
    await queryInterface.removeIndex('drivers', 'drivers_external_id_unique');

    await queryInterface.removeColumn('races', 'externalId');
    await queryInterface.removeColumn('teams', 'externalId');
    await queryInterface.removeColumn('drivers', 'externalId');
  },
};
