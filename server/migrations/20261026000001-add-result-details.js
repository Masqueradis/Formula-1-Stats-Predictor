'use strict';

/**
 * Эпик-10: детали полной классификации из Jolpica.
 * Нужны для исторических Гран-при (2000–2025), где в таблице показываются
 * не только позиция/очки, но и время/статус схода и число кругов.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('race_results', 'positionText', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
    await queryInterface.addColumn('race_results', 'status', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('race_results', 'time', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await queryInterface.addColumn('race_results', 'laps', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('race_results', 'laps');
    await queryInterface.removeColumn('race_results', 'time');
    await queryInterface.removeColumn('race_results', 'status');
    await queryInterface.removeColumn('race_results', 'positionText');
  },
};
