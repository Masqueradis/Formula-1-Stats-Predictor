'use strict';

/** US-7 (эпик-09): ссылка на трансляцию Гран-при у гонки */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('races', 'broadcastUrl', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('races', 'broadcastUrl');
  },
};
