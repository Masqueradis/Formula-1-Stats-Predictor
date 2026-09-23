'use strict';

// Локальные метаданные команд: Jolpica не отдаёт цвета, руководителей и т.д.
const TEAM_META = {
  mclaren: {
    name: 'McLaren',
    principal: 'Andrea Stella',
    nationality: 'British',
    url: 'https://www.mclaren.com/racing',
    color: '#FF8000',
  },
  mercedes: {
    name: 'Mercedes-AMG Petronas',
    principal: 'Toto Wolff',
    nationality: 'German',
    url: 'https://www.mercedesamgf1.com',
    color: '#27F4D2',
  },
  red_bull: {
    name: 'Red Bull Racing',
    principal: 'Laurent Mekies',
    nationality: 'Austrian',
    url: 'https://www.redbullracing.com',
    color: '#3671C6',
  },
  ferrari: {
    name: 'Ferrari',
    principal: 'Frédéric Vasseur',
    nationality: 'Italian',
    url: 'https://www.ferrari.com',
    color: '#E80020',
  },
  williams: {
    name: 'Williams',
    principal: 'James Vowles',
    nationality: 'British',
    url: 'https://www.williamsf1.com',
    color: '#64C4FF',
  },
  rb: {
    name: 'Racing Bulls',
    principal: 'Alan Permane',
    nationality: 'Italian',
    url: 'https://www.visacashapprb.com',
    color: '#6692FF',
  },
  aston_martin: {
    name: 'Aston Martin',
    principal: 'Adrian Newey',
    nationality: 'British',
    url: 'https://www.astonmartinf1.com',
    color: '#229971',
  },
  haas: {
    name: 'Haas',
    principal: 'Ayao Komatsu',
    nationality: 'American',
    url: 'https://www.haasf1team.com',
    color: '#E10600',
  },
  audi: {
    name: 'Audi',
    principal: 'Jonathan Wheatley',
    nationality: 'German',
    url: 'https://www.audi.com/formula1',
    color: '#8A8D8F',
  },
  alpine: {
    name: 'Alpine',
    principal: 'Steve Nielsen',
    nationality: 'French',
    url: 'https://www.alpinecars.com/formula-1',
    color: '#0093CC',
  },
  cadillac: {
    name: 'Cadillac',
    principal: 'Graeme Lowdon',
    nationality: 'American',
    url: 'https://www.cadillacf1team.com',
    color: '#C0C0C0',
  },
};

module.exports = { TEAM_META };
