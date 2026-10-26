'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Race extends Model {
    static associate(models) {
      Race.hasMany(models.RaceResult, { foreignKey: 'raceId', as: 'results' });
    }
  }

  Race.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    externalId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    circuit: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    season: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    round: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'finished', 'cancelled'),
      allowNull: false,
      defaultValue: 'scheduled',
    },
    trackLatitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
    },
    trackLongitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
    },
    // US-7 (эпик-09): ссылка на онлайн-трансляцию (заполняется админом)
    broadcastUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Race',
    tableName: 'races',
    timestamps: true,
    indexes: [
      { name: 'races_season_round_unique', unique: true, fields: ['season', 'round'] },
    ],
  });

  return Race;
};
