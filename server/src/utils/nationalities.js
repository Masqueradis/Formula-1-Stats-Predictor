'use strict';

const NATIONALITY_RU = Object.freeze({
  American: 'США',
  Argentine: 'Аргентина',
  Australian: 'Австралия',
  Austrian: 'Австрия',
  Belgian: 'Бельгия',
  Brazilian: 'Бразилия',
  British: 'Великобритания',
  Canadian: 'Канада',
  Chilean: 'Чили',
  Chinese: 'Китай',
  Colombian: 'Колумбия',
  Czech: 'Чехия',
  Danish: 'Дания',
  Dutch: 'Нидерланды',
  'East German': 'ГДР',
  Emirati: 'ОАЭ',
  Finnish: 'Финляндия',
  French: 'Франция',
  German: 'Германия',
  Hungarian: 'Венгрия',
  Indian: 'Индия',
  Indonesian: 'Индонезия',
  Irish: 'Ирландия',
  Italian: 'Италия',
  Japanese: 'Япония',
  Liechtensteiner: 'Лихтенштейн',
  Malaysian: 'Малайзия',
  Mexican: 'Мексика',
  Monegasque: 'Монако',
  'New Zealander': 'Новая Зеландия',
  Polish: 'Польша',
  Portuguese: 'Португалия',
  Rhodesian: 'Родезия',
  Russian: 'Россия',
  Saudi: 'Саудовская Аравия',
  'South African': 'ЮАР',
  Spanish: 'Испания',
  Swedish: 'Швеция',
  Swiss: 'Швейцария',
  Thai: 'Таиланд',
  Turkish: 'Турция',
  Uruguayan: 'Уругвай',
  Venezuelan: 'Венесуэла',
  Unknown: 'Не указана',
});

const LOOKUP = new Map(
  Object.entries(NATIONALITY_RU).map(([english, russian]) => [english.toLowerCase(), russian]),
);

function toRussianNationality(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return LOOKUP.get(trimmed.toLowerCase()) || trimmed;
}

module.exports = { NATIONALITY_RU, toRussianNationality };
