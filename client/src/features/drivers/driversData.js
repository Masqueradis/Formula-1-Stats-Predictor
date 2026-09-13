export const TEAMS = [
  { name: 'Red Bull Racing', color: '#3671C6' },
  { name: 'Ferrari', color: '#E80020' },
  { name: 'Mercedes-AMG Petronas', color: '#27F4D2' },
  { name: 'McLaren', color: '#FF8000' },
  { name: 'Aston Martin', color: '#229971' },
]

export const TEAM_NAMES = TEAMS.map((t) => t.name)

export const mockDrivers = [
  {
    id: 1,
    firstName: 'Max',
    lastName: 'Verstappen',
    abbreviation: 'VER',
    number: 1,
    team: 'Red Bull Racing',
    nationality: 'Dutch',
    podiums: 113,
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg/330px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg',
  },
  {
    id: 2,
    firstName: 'Lewis',
    lastName: 'Hamilton',
    abbreviation: 'HAM',
    number: 44,
    team: 'Ferrari',
    nationality: 'British',
    podiums: 202,
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg/330px-Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg',
  },
  {
    id: 3,
    firstName: 'Charles',
    lastName: 'Leclerc',
    abbreviation: 'LEC',
    number: 16,
    team: 'Ferrari',
    nationality: 'Monégasque',
    podiums: 43,
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg/330px-Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg',
  },
  {
    id: 4,
    firstName: 'Lando',
    lastName: 'Norris',
    abbreviation: 'NOR',
    number: 4,
    team: 'McLaren',
    nationality: 'British',
    podiums: 26,
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/330px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg',
  },
  {
    id: 5,
    firstName: 'Fernando',
    lastName: 'Alonso',
    abbreviation: 'ALO',
    number: 14,
    team: 'Aston Martin',
    nationality: 'Spanish',
    podiums: 106,
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Alonso-68_%2824710447098%29.jpg/330px-Alonso-68_%2824710447098%29.jpg',
  },
]

export function teamColor(teamName) {
  const team = TEAMS.find((t) => t.name === teamName)
  return team ? team.color : '#0ea5e9'
}
