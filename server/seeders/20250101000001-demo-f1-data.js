'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('users', [
      { username: 'admin', email: 'admin@f1stats.test', passwordHash: 'placeholder-admin-hash', role: 'ADMIN', createdAt: new Date(), updatedAt: new Date() },
      { username: 'maxfan', email: 'maxfan@f1stats.test', passwordHash: 'placeholder-user-hash', role: 'USER', createdAt: new Date(), updatedAt: new Date() },
    ], {});

    await queryInterface.bulkInsert('drivers', [
      { firstName: 'Max', lastName: 'Verstappen', abbreviation: 'VER', number: 1, nationality: 'Dutch', dateOfBirth: '1997-09-30', imageUrl: null, podiums: 113, createdAt: new Date(), updatedAt: new Date() },
      { firstName: 'Lewis', lastName: 'Hamilton', abbreviation: 'HAM', number: 44, nationality: 'British', dateOfBirth: '1985-01-07', imageUrl: null, podiums: 202, createdAt: new Date(), updatedAt: new Date() },
      { firstName: 'Charles', lastName: 'Leclerc', abbreviation: 'LEC', number: 16, nationality: 'Monégasque', dateOfBirth: '1997-10-16', imageUrl: null, podiums: 43, createdAt: new Date(), updatedAt: new Date() },
      { firstName: 'Lando', lastName: 'Norris', abbreviation: 'NOR', number: 4, nationality: 'British', dateOfBirth: '1999-11-13', imageUrl: null, podiums: 26, createdAt: new Date(), updatedAt: new Date() },
      { firstName: 'Fernando', lastName: 'Alonso', abbreviation: 'ALO', number: 14, nationality: 'Spanish', dateOfBirth: '1981-07-29', imageUrl: null, podiums: 106, createdAt: new Date(), updatedAt: new Date() },
    ], {});

    await queryInterface.bulkInsert('teams', [
      { name: 'Red Bull Racing', principal: 'Christian Horner', nationality: 'Austrian', url: 'https://www.redbullracing.com', color: '#3671C6', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Ferrari', principal: 'Fred Vasseur', nationality: 'Italian', url: 'https://www.ferrari.com', color: '#E80020', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Mercedes-AMG Petronas', principal: 'Toto Wolff', nationality: 'German', url: 'https://www.mercedesamgf1.com', color: '#27F4D2', createdAt: new Date(), updatedAt: new Date() },
      { name: 'McLaren', principal: 'Andrea Stella', nationality: 'British', url: 'https://www.mclaren.com/racing', color: '#FF8000', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Aston Martin', principal: 'Mike Krack', nationality: 'British', url: 'https://www.astonmartinf1.com', color: '#229971', createdAt: new Date(), updatedAt: new Date() },
    ], {});

    await queryInterface.bulkInsert('races', [
      { name: 'Australian Grand Prix', circuit: 'Albert Park', country: 'Australia', date: '2025-03-16', season: 2025, round: 1, status: 'finished', trackLatitude: -37.8497, trackLongitude: 144.968, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Chinese Grand Prix', circuit: 'Shanghai International Circuit', country: 'China', date: '2025-03-23', season: 2025, round: 2, status: 'finished', trackLatitude: 31.3389, trackLongitude: 121.2201, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Japanese Grand Prix', circuit: 'Suzuka International Racing Course', country: 'Japan', date: '2025-04-06', season: 2025, round: 3, status: 'scheduled', trackLatitude: 34.8431, trackLongitude: 136.541, createdAt: new Date(), updatedAt: new Date() },
    ], {});

    await queryInterface.bulkInsert('season_teams', [
      { season: 2025, driverId: 1, teamId: 1, createdAt: new Date(), updatedAt: new Date() },
      { season: 2025, driverId: 2, teamId: 2, createdAt: new Date(), updatedAt: new Date() },
      { season: 2025, driverId: 3, teamId: 2, createdAt: new Date(), updatedAt: new Date() },
      { season: 2025, driverId: 4, teamId: 4, createdAt: new Date(), updatedAt: new Date() },
      { season: 2025, driverId: 5, teamId: 5, createdAt: new Date(), updatedAt: new Date() },
    ], {});

    await queryInterface.bulkInsert('race_results', [
      { raceId: 1, driverId: 1, position: 1, points: 25, grid: 1, fastestLap: true, createdAt: new Date(), updatedAt: new Date() },
      { raceId: 1, driverId: 2, position: 2, points: 18, grid: 3, fastestLap: false, createdAt: new Date(), updatedAt: new Date() },
      { raceId: 1, driverId: 3, position: 3, points: 15, grid: 5, fastestLap: false, createdAt: new Date(), updatedAt: new Date() },
      { raceId: 2, driverId: 4, position: 1, points: 25, grid: 2, fastestLap: false, createdAt: new Date(), updatedAt: new Date() },
      { raceId: 2, driverId: 1, position: 2, points: 18, grid: 1, fastestLap: true, createdAt: new Date(), updatedAt: new Date() },
      { raceId: 2, driverId: 3, position: 3, points: 15, grid: 4, fastestLap: false, createdAt: new Date(), updatedAt: new Date() },
    ], {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('race_results', null, {});
    await queryInterface.bulkDelete('season_teams', null, {});
    await queryInterface.bulkDelete('races', null, {});
    await queryInterface.bulkDelete('teams', null, {});
    await queryInterface.bulkDelete('drivers', null, {});
    await queryInterface.bulkDelete('users', null, {});
  },
};
