'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('drivers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      firstName: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      abbreviation: {
        type: Sequelize.STRING(3),
        allowNull: false,
        unique: true,
      },
      number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      nationality: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      dateOfBirth: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      imageUrl: {
        type: Sequelize.STRING(500),
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('drivers');
  },
};
