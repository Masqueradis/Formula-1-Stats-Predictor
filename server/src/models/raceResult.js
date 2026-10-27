'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RaceResult extends Model {
    static associate(models) {
      RaceResult.belongsTo(models.Race, { foreignKey: 'raceId', as: 'race' });
      RaceResult.belongsTo(models.Driver, { foreignKey: 'driverId', as: 'driver' });
      RaceResult.belongsTo(models.Team, { foreignKey: 'teamId', as: 'team' });
    }
  }

  RaceResult.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    raceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'races', key: 'id' },
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'drivers', key: 'id' },
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'teams', key: 'id' },
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Эпик-10: детали исторической классификации
    positionText: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    time: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    laps: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    points: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: true,
    },
    grid: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fastestLap: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    sessionType: {
      type: DataTypes.ENUM('race', 'sprint'),
      allowNull: false,
      defaultValue: 'race',
    },
  }, {
    sequelize,
    modelName: 'RaceResult',
    tableName: 'race_results',
    timestamps: true,
    indexes: [
      { name: 'race_results_race_driver_session_unique', unique: true, fields: ['raceId', 'driverId', 'sessionType'] },
    ],
  });

  return RaceResult;
};
