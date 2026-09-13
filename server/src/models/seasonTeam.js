'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SeasonTeam extends Model {
    static associate(models) {
      SeasonTeam.belongsTo(models.Driver, { foreignKey: 'driverId', as: 'driver' });
      SeasonTeam.belongsTo(models.Team, { foreignKey: 'teamId', as: 'team' });
    }
  }

  SeasonTeam.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    season: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'drivers', key: 'id' },
    },
  }, {
    sequelize,
    modelName: 'SeasonTeam',
    tableName: 'season_teams',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['season', 'teamId', 'driverId'],
      },
    ],
  });

  return SeasonTeam;
};
