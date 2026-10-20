'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'verificationToken', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'isVerified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'isVerified');
    await queryInterface.removeColumn('users', 'verificationToken');
  },
};