
const EXACT = {
  'Invalid credentials': 'Неверный email или пароль.',
  'Email not verified. Check your inbox.': 'Email не подтверждён. Проверьте почту или запросите ссылку повторно.',
  'Email already registered': 'Этот email уже зарегистрирован.',
  'Password must be at least 6 characters long': 'Пароль должен содержать минимум 6 символов.',
  'username, email and password are required': 'Заполните имя пользователя, email и пароль.',
  'email and password are required': 'Укажите email и пароль.',
  'Verification token is required': 'Не указан токен подтверждения.',
  'Invalid or expired verification token': 'Ссылка подтверждения недействительна или устарела.',
  'User not found': 'Пользователь не найден.',
  'season must be a valid year': 'Укажите корректный сезон (1950–2100).',
  'broadcastUrl must be a valid http(s) URL': 'Ссылка на трансляцию должна начинаться с http:// или https://.',
  'broadcastUrl is too long (max 500 characters)': 'Ссылка на трансляцию слишком длинная (максимум 500 символов).',
  'Team not found': 'Команда не найдена.',
  'team not found': 'Команда не найдена.',
  'driver not found': 'Пилот не найден.',
  'Driver not found': 'Пилот не найден.',
  'race not found': 'Гонка не найдена.',
  'race result not found': 'Результат гонки не найден.',
  'Invalid id': 'Некорректный идентификатор записи.',
  'Invalid raceId': 'Некорректная гонка.',
  'Invalid driverId': 'Некорректный пилот.',
  'Driver already in favorites': 'Пилот уже в избранном.',
  'Team already in favorites': 'Команда уже в избранном.',
  'Too many requests, please try again later.': 'Слишком много запросов. Попробуйте позже.',
  'SMTP is not configured': 'Почтовый сервис не настроен. Обратитесь к администратору.',
}

const PATTERNS = [
  [/^(.+) not found$/, 'Запись не найдена.'],
  [/season must be a valid year/i, 'Укажите корректный сезон (1950–2100).'],
  [/must be an integer/i, 'Проверьте числовые поля: ожидается целое число.'],
  [/must be a number/i, 'Проверьте числовые поля.'],
  [/must be a boolean/i, 'Некорректное логическое значение.'],
  [/must be one of/i, 'Недопустимое значение поля.'],
  [/invalid input syntax for type date/i, 'Проверьте формат даты.'],
  [/invalid input syntax for type numeric/i, 'Проверьте числовые поля (широта/долгота).'],
  [/unique constraint/i, 'Такая запись уже существует.'],
  [/Validation notNull/i, 'Заполните обязательные поля.'],
  [/Validation error/i, 'Проверьте заполнение полей формы.'],
  [/is too long|value too long/i, 'Слишком длинное значение поля.'],
]

const STATUS_FALLBACK = {
  401: 'Требуется авторизация.',
  403: 'Недостаточно прав для этого действия.',
  404: 'Запись не найдена.',
  409: 'Конфликт данных: запись уже существует или связана с другими.',
  429: 'Слишком много запросов. Попробуйте позже.',
  500: 'Ошибка сервера. Попробуйте позже.',
  503: 'Сервис временно недоступен. Попробуйте позже.',
}

export function translateApiMessage(raw) {
  if (!raw) return null
  const text = String(raw).trim()
  if (!text) return null
  if (EXACT[text]) return EXACT[text]
  for (const [pattern, message] of PATTERNS) {
    if (pattern.test(text)) return message
  }
  if (/[а-яё]/i.test(text)) return text
  return null
}

export default function errorMessage(err, fallback = 'Не удалось выполнить действие. Попробуйте ещё раз.') {
  if (!err) return fallback
  if (!err.response) {
    if (err.code === 'ECONNABORTED') return 'Сервер долго не отвечает. Попробуйте позже.'
    return 'Нет связи с сервером. Проверьте подключение.'
  }

  const data = err.response.data
  const raw = typeof data === 'string' ? data : data?.error
  const details = !Array.isArray(data) ? data?.details : null

  const translatedDetails = Array.isArray(details)
    ? details.map((item) => translateApiMessage(item)).filter(Boolean)
    : []
  if (translatedDetails.length) return translatedDetails.join(' ')

  const translated = translateApiMessage(raw)
  if (translated) return translated

  return STATUS_FALLBACK[err.response.status] || fallback
}
