'use strict';

/**
 * Архив новостей (эпик-09, P4): постоянное хранение RSS-пула в Postgres +
 * полнотекстовый поиск. searchVector — генерируемая колонка (simple-конфиг,
 * без стемминга: лента смешанная ru/en), GIN-индекс для @@-запросов.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('news_items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      link: {
        type: Sequelize.STRING(1000),
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      sourceId: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      sourceName: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      lang: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
      imageUrl: {
        type: Sequelize.STRING(1000),
        allowNull: true,
      },
      publishedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('news_items', ['publishedAt']);
    await queryInterface.addIndex('news_items', ['sourceId']);

    await queryInterface.sequelize.query(`
      ALTER TABLE news_items
      ADD COLUMN "searchVector" tsvector
      GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
      ) STORED
    `);
    await queryInterface.sequelize.query(
      'CREATE INDEX news_items_search_idx ON news_items USING GIN ("searchVector")',
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('news_items');
  },
};
