'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('races', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      circuit: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      season: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      round: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'finished', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled',
      },
      trackLatitude: {
        type: Sequelize.DECIMAL(9, 6),
        allowNull: true,
      },
      trackLongitude: {
        type: Sequelize.DECIMAL(9, 6),
        allowNull: true,
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

    await queryInterface.addIndex('races', ['season', 'round'], {
      unique: true,
      name: 'races_season_round_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('races');
  },
};
