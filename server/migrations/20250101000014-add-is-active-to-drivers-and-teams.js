'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('drivers', 'isActive', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('teams', 'isActive', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('drivers', 'isActive');
    await queryInterface.removeColumn('teams', 'isActive');
  },
};
