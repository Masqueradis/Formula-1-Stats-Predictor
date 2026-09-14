'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Team extends Model {
    static associate(models) {
      Team.belongsToMany(models.Driver, {
        through: models.SeasonTeam,
        foreignKey: 'teamId',
        as: 'drivers',
      });
      Team.hasMany(models.SeasonTeam, { foreignKey: 'teamId', as: 'seasonTeams' });
      Team.belongsToMany(models.User, {
        through: 'UserFavoriteTeam',
        foreignKey: 'teamId',
        as: 'fans',
      });
    }
  }

  Team.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    principal: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    nationality: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Team',
    tableName: 'teams',
    timestamps: true,
  });

  return Team;
};
