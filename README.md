<div align="center">

# 🤖 onix

**Minecraft AFK-бот с управлением через Telegram**

Держит персонажа онлайн на сервере и управляется одним меню в Telegram — без SSH, без консоли, без перезапусков.

[![CI](https://github.com/UrelzOfficial/onix/actions/workflows/check.yml/badge.svg)](https://github.com/UrelzOfficial/onix/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)
[![mineflayer](https://img.shields.io/badge/mineflayer-4.37-blue)](https://github.com/PrismarineJS/mineflayer)

[Установка](#-установка-с-нуля) · [Возможности](#-возможности) · [Настройки](#-настройки-через-telegram) · [FAQ](#-faq)

</div>

---

## ✨ Возможности

| | |
|---|---|
| 📱 **Telegram-меню** | Старт, стоп, логи, настройки — всё в одном чате |
| ⚙️ **Live-настройки** | Адрес, порт, версия, ник и пароль меняются без перезапуска |
| 🔁 **Авто-реконнект** | Быстрая фаза → медленная фаза, бесконечно, до победы |
| 🔐 **3 режима auth** | `FORCED` / `AUTO` / `OFF` — для AuthMe и подобных |
| 🎭 **Реалистичные ники** | `STATIC` (фикс) или `RANDOM` (имя + игровое слово) |
| 🏃 **Умный AFK** | Прыжки, движение, поворот камеры — через pathfinder |
| 🛡 **Анти-моб** | Бегство от враждебных мобов в радиусе |
| ⚔️ **Опц. бой** | Атака слабых мобов при наличии оружия (крипер/варден игнорятся) |
| 📜 **Кольцевой лог** | Последние N строк прямо в Telegram |

---

## 🚀 Установка с нуля

> Инструкция подходит даже если вы впервые слышите про Node.js. Шаги выполняйте по порядку.

### Шаг 1. Установите Node.js

Скачайте и установите **LTS-версию** (≥ 18) с официального сайта:
👉 [nodejs.org](https://nodejs.org/)

После установки откройте терминал (`cmd` на Windows, `Terminal` на Mac/Linux) и проверьте:
```bash
node -v
```
Должна появиться версия, например `v20.11.0`. Если так — Node.js установлен.

### Шаг 2. Скачайте проект

**Вариант А — через git** (если установлен):
```bash
git clone https://github.com/UrelzOfficial/onix.git
cd onix
```

**Вариант Б — без git:**
1. На странице репозитория нажмите зелёную кнопку **Code** → **Download ZIP**
2. Распакуйте архив в удобную папку
3. Откройте терминал **внутри этой папки** (на Windows: Shift + ПКМ → «Открыть в терминале»)

### Шаг 3. Установите зависимости

В терминале, находясь в папке проекта:
```bash
npm install
```
Подождите 1–2 минуты, пока скачаются библиотеки.

### Шаг 4. Создайте Telegram-бота

1. Откройте в Telegram [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Придумайте имя (любое) и username (должен заканчиваться на `bot`)
4. BotFather пришлёт **токен** вида `1234567890:AAH...` — скопируйте его, он нужен дальше

### Шаг 5. Узнайте свой Chat ID

1. Откройте в Telegram [@userinfobot](https://t.me/userinfobot)
2. Нажмите **Start**
3. Бот пришлёт ваш `Id` — это и есть ваш **Chat ID** (число вида `123456789`)

### Шаг 6. Настройте бота

В папке проекта найдите файл `.env.example` и скопируйте его, переименовав в `.env`:

**Windows:**
```bash
copy .env.example .env
```
**Mac/Linux:**
```bash
cp .env.example .env
```

Откройте `.env` любым редактором (Блокнот, VS Code) и заполните **три строки**:
```env
TELEGRAM_TOKEN=сюда_токен_от_BotFather
ADMIN_CHAT_ID=сюда_ваш_chat_id_от_userinfobot
MC_HOST=адрес_minecraft_сервера.com
```
Сохраните файл.

### Шаг 7. Запуск

В терминале:
```bash
npm start
```

Откройте в Telegram своего бота (того, что создали в шаге 4), отправьте `/menu` — появится меню управления. Готово! 🎉

> 💡 Чтобы остановить бота — нажмите `Ctrl + C` в терминале.

---

## 📱 Команды Telegram

| Команда | Что делает |
|---------|------------|
| `/menu` | Главное меню (старт/стоп/логи/настройки) |
| `/status` | Краткий статус бота |
| `/help` | Справка |

---

## ⚙️ Настройки через Telegram

Меняются в меню **⚙️ Настройки** на лету:

| Параметр | Кнопка | Примечание |
|----------|--------|-----------|
| Адрес сервера | 🖥 Изменить сервер | Применяется при следующем подключении |
| Порт | 🔌 Порт | 1–65535 |
| Версия MC | 🏷 Изменить версию | `1.20.1` или `auto` |
| Пароль | 🔑 Изменить пароль | Не отображается в открытом виде |
| Auth-режим | 🔐 Авторизация | `FORCED` / `AUTO` / `OFF` |
| Режим ника | 🎲 Режим ника | `STATIC` / `RANDOM` |
| Статичный ник | ✏️ Задать ник | Латиница/цифры/`_`, 3–16 символов |

---

## 🔧 Переменные окружения

<details>
<summary><b>Обязательные</b> (3)</summary>

| Переменная | Описание |
|-----------|----------|
| `TELEGRAM_TOKEN` | Токен от @BotFather |
| `ADMIN_CHAT_ID` | Chat ID администратора |
| `MC_HOST` | Адрес Minecraft-сервера |

</details>

<details>
<summary><b>Minecraft</b></summary>

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `MC_PORT` | `24730` | Порт сервера |
| `MC_USERNAME` | `AFKBot` | Ник в режиме STATIC |
| `MC_REGISTER_PASS` | — | Пароль для `/register` и `/login` |
| `MC_AUTH_MODE` | `FORCED` | `FORCED` / `AUTO` / `OFF` |
| `MC_NICK_MODE` | `STATIC` | `STATIC` / `RANDOM` |
| `MC_VERSION` | auto | `1.20.1` или пусто = автоопределение |

</details>

<details>
<summary><b>Реконнект и таймеры</b></summary>

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `MC_RECONNECT_INTERVAL_MS` | `30000` | Быстрая фаза реконнекта |
| `MC_SLOW_RETRY_AFTER` | `5` | После N попыток → медленная фаза |
| `MC_SLOW_RETRY_INTERVAL_MS` | `300000` | Медленная фаза (бесконечно) |
| `MC_RANDOM_ACTION_INTERVAL_MS` | `60000` | Интервал AFK-действий |
| `MC_STATUS_INTERVAL_MS` | `3600000` | Интервал сервисной записи в лог |
| `MAX_LOG_LINES` | `80` | Размер кольцевого буфера |
| `TG_NOTIFICATION_TTL_MS` | `10000` | TTL временных уведомлений |
| `TG_LOGS_TTL_MS` | `30000` | TTL сообщения с логами |

</details>

<details>
<summary><b>AI / Pathfinder / Бой</b></summary>

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `MC_SMART_AFK` | `true` | Умное AFK через pathfinder |
| `MC_AVOID_MOBS` | `false` | Бегство от враждебных мобов |
| `MC_AVOID_CLIFFS` | `true` | Не падать с обрывов |
| `MC_AVOID_WATER` | `true` | Обходить воду |
| `MC_DETECTION_RADIUS` | `16` | Радиус обнаружения мобов |
| `MC_MOB_SCAN_INTERVAL_MS` | `500` | Интервал сканирования |
| `MC_FLEE_DISTANCE` | `16` | Целевая дистанция при бегстве |
| `MC_PATHFIND_TIMEOUT_MS` | `1500` | Таймаут поиска пути |
| `MC_STUCK_TIMEOUT_MS` | `10000` | Порог простоя для stuck-recovery |
| `MC_STUCK_SCAN_INTERVAL_MS` | `2000` | Интервал проверки stuck |
| `MC_COMBAT_ENABLED` | `false` | Атаковать слабых мобов |
| `MC_VERBOSE_AFK` | `false` | Подробный лог AFK-действий |

</details>

<details>
<summary><b>Опциональные</b></summary>

| Переменная | Описание |
|-----------|----------|
| `ADMIN_USER_ID` | User ID для защиты в группах |

</details>

---

## 🧰 npm-скрипты

| Команда | Действие |
|---------|---------|
| `npm start` | Запустить бота |
| `npm run check` | Синтаксическая проверка всех файлов |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint с автоисправлением |
| `npm run format` | Prettier-форматирование |
| `npm run get-chat-id` | Узнать свой chat ID |
| `npm run fix-polling` | Сбросить webhook и очередь Telegram |
| `npm run test-telegram` | Проверить подключение к Telegram API |

---

## 📂 Структура проекта

```
onix/
├── .github/workflows/check.yml   # CI: lint + syntax (Node 18, 20)
├── scripts/                      # Утилиты (check, get-chat-id, и т.д.)
├── src/
│   ├── config.js                 # Загрузка и валидация .env
│   ├── index.js                  # Bootstrap, Telegram handlers
│   ├── logger.js                 # Кольцевой буфер логов
│   ├── minecraft-controller.js   # Жизненный цикл MC-бота
│   ├── persistence.js            # Атомарная запись .env
│   ├── ai/                       # Pathfinder, stuck-recovery, combat
│   ├── telegram/menus.js         # Построители меню
│   └── utils/html.js             # Экранирование HTML
├── bot.js                        # Точка входа
├── .env.example
├── CHANGELOG.md
└── package.json
```

---

## ❓ FAQ

<details>
<summary><b>Бот не подключается — что проверить?</b></summary>

1. Сервер действительно онлайн? Проверьте через клиент.
2. Версия Minecraft совпадает? Попробуйте `MC_VERSION=auto`.
3. Если сервер на Aternos — он мог уснуть, дождитесь старта.
4. Проверьте логи через 📜 в Telegram-меню.

</details>

<details>
<summary><b>Telegram не отвечает на /menu</b></summary>

1. `npm run test-telegram` — проверит API.
2. `npm run fix-polling` — сбросит webhook и очередь.
3. Убедитесь, что `ADMIN_CHAT_ID` совпадает с вашим (получите через `npm run get-chat-id`).

</details>

<details>
<summary><b>Сервер требует /register или /login</b></summary>

Это плагин авторизации (AuthMe и т.п.). Установите `MC_AUTH_MODE=FORCED` и задайте `MC_REGISTER_PASS`. Бот сам отправит команды.

</details>

<details>
<summary><b>Бота кикает за AFK</b></summary>

Увеличьте частоту действий — снизьте `MC_RANDOM_ACTION_INTERVAL_MS` (например, `30000`). Также включите `MC_SMART_AFK=true`.

</details>

---

## 🔒 Безопасность

- **Никогда не коммитьте `.env`** — он в `.gitignore`.
- Если токен попал в открытый код — перевыпустите его в @BotFather.
- В групповых чатах используйте `ADMIN_USER_ID` для защиты.
- Не публикуйте реальный пароль в скриншотах или видео.
- ⚠️ Пароль из `MC_REGISTER_PASS` отправляется в чат сервера через `/login` и `/register` — это штатно для AuthMe-подобных плагинов, но **админ сервера видит его в server-логах**. Заведите для бота отдельный пароль, не используйте основной.

---

## 🤝 Вклад

PR и issues приветствуются. Перед коммитом:
```bash
npm run check && npm run lint
```

---

## 📄 Лицензия

[MIT](LICENSE) © UrelzOfficial
