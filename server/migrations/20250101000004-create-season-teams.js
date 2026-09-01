'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('season_teams', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      season: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      teamId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'teams', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      driverId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'drivers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('season_teams', ['season', 'teamId', 'driverId'], {
      unique: true,
      name: 'season_teams_season_team_driver_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('season_teams');
  },
};
