'use strict';

/**
 * Индексы для запросов истории (эпик-10).
 *
 * Миграция идемпотентна: `sequelize.sync()` и предыдущие частичные прогоны
 * могли уже создать часть индексов, поэтому перед созданием проверяем
 * фактическое состояние схемы. Индексы по `externalId` не дублируем —
 * уникальные индексы `*_external_id_unique` уже созданы миграцией 11.
 */

const INDEXES = [
  { table: 'races', name: 'races_season_round', fields: ['season', 'round'] },
  { table: 'races', name: 'races_season_date', fields: ['season', 'date'] },
  { table: 'race_results', name: 'race_results_race_id', fields: ['raceId'] },
  { table: 'race_results', name: 'race_results_driver_id', fields: ['driverId'] },
  { table: 'race_results', name: 'race_results_race_team', fields: ['raceId', 'teamId'] },
  {
    table: 'season_teams',
    name: 'season_teams_season_driver_team',
    fields: ['season', 'driverId', 'teamId'],
  },
];

async function hasIndex(queryInterface, table, name) {
  const indexes = await queryInterface.showIndex(table);
  return indexes.some((index) => index.name === name);
}

module.exports = {
  async up(queryInterface) {
    for (const index of INDEXES) {
      if (!(await hasIndex(queryInterface, index.table, index.name))) {
        await queryInterface.addIndex(index.table, index.fields, { name: index.name });
      }
    }
  },

  async down(queryInterface) {
    for (const index of INDEXES) {
      if (await hasIndex(queryInterface, index.table, index.name)) {
        await queryInterface.removeIndex(index.table, index.name);
      }
    }
  },
};
