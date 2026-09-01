'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('race_results', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      raceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'races', key: 'id' },
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
      position: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      points: {
        type: Sequelize.DECIMAL(4, 1),
        allowNull: true,
      },
      grid: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      fastestLap: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
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

    await queryInterface.addIndex('race_results', ['raceId', 'driverId'], {
      unique: true,
      name: 'race_results_race_driver_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('race_results');
  },
};
