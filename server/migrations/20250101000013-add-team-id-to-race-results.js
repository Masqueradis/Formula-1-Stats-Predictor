'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('race_results', 'teamId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'teams', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.addIndex('race_results', ['raceId', 'teamId'], {
      name: 'race_results_race_team_index',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('race_results', 'race_results_race_team_index');
    await queryInterface.removeColumn('race_results', 'teamId');
  },
};