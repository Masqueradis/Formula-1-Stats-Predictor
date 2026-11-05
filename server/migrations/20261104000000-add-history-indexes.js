'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('races', ['season', 'round']);
    await queryInterface.addIndex('races', ['season', 'date']);
    await queryInterface.addIndex('race_results', ['raceId']);
    await queryInterface.addIndex('race_results', ['driverId']);
    await queryInterface.addIndex('race_results', ['raceId', 'teamId']);
    await queryInterface.addIndex('season_teams', ['season', 'driverId', 'teamId']);
    await queryInterface.addIndex('drivers', ['externalId']);
    await queryInterface.addIndex('teams', ['externalId']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('races', ['season', 'round']);
    await queryInterface.removeIndex('races', ['season', 'date']);
    await queryInterface.removeIndex('race_results', ['raceId']);
    await queryInterface.removeIndex('race_results', ['driverId']);
    await queryInterface.removeIndex('race_results', ['raceId', 'teamId']);
    await queryInterface.removeIndex('season_teams', ['season', 'driverId', 'teamId']);
    await queryInterface.removeIndex('drivers', ['externalId']);
    await queryInterface.removeIndex('teams', ['externalId']);
  },
};
