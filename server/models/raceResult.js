'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RaceResult extends Model {
    static associate(models) {
      RaceResult.belongsTo(models.Race, { foreignKey: 'raceId', as: 'race' });
      RaceResult.belongsTo(models.Driver, { foreignKey: 'driverId', as: 'driver' });
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
    position: {
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
  }, {
    sequelize,
    modelName: 'RaceResult',
    tableName: 'race_results',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['raceId', 'driverId'] },
    ],
  });

  return RaceResult;
};
