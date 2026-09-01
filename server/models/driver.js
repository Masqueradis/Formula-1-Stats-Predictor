'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Driver extends Model {
    static associate(models) {
      Driver.belongsToMany(models.Team, {
        through: models.SeasonTeam,
        foreignKey: 'driverId',
        as: 'teams',
      });
      Driver.hasMany(models.SeasonTeam, { foreignKey: 'driverId', as: 'seasonTeams' });
      Driver.hasMany(models.RaceResult, { foreignKey: 'driverId', as: 'raceResults' });
      Driver.belongsToMany(models.User, {
        through: 'UserFavoriteDriver',
        foreignKey: 'driverId',
        as: 'fans',
      });
    }
  }

  Driver.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    abbreviation: {
      type: DataTypes.STRING(3),
      allowNull: false,
      unique: true,
    },
    number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    nationality: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    podiums: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    sequelize,
    modelName: 'Driver',
    tableName: 'drivers',
    timestamps: true,
  });

  return Driver;
};
