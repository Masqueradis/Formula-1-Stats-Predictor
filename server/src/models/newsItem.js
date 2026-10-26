'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class NewsItem extends Model {}

  NewsItem.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    link: {
      type: DataTypes.STRING(1000),
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sourceId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    sourceName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    lang: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'NewsItem',
    tableName: 'news_items',
    // Генерируемая колонка searchVector не описана в модели — её пишет Postgres
    timestamps: true,
  });

  return NewsItem;
};
