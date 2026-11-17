'use strict';

/** Эпик-12: срок действия токена подтверждения email (24 часа). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'verificationExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'verificationExpiresAt');
  },
};
