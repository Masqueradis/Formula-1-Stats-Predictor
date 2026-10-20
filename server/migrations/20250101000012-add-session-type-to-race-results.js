'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('race_results', 'sessionType', {
      type: Sequelize.ENUM('race', 'sprint'),
      allowNull: false,
      defaultValue: 'race',
    });

    await queryInterface.removeIndex('race_results', 'race_results_race_driver_unique');
    await queryInterface.addIndex('race_results', ['raceId', 'driverId', 'sessionType'], {
      unique: true,
      name: 'race_results_race_driver_session_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('race_results', 'race_results_race_driver_session_unique');
    await queryInterface.bulkDelete('race_results', { sessionType: 'sprint' });
    await queryInterface.addIndex('race_results', ['raceId', 'driverId'], {
      unique: true,
      name: 'race_results_race_driver_unique',
    });
    await queryInterface.removeColumn('race_results', 'sessionType');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_race_results_sessionType"');
  },
};
