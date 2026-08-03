# dobrypiter.pro

Сайт боксерского клуба «Добрый Питер» (СПб).

## Структура

- `web/` — статичный фронт (HTML/CSS/JS, без сборки), nginx отдаёт его напрямую
- `web/admin/` — SPA админки (логин + редактор расписания)
- `api/` — Node.js + Express бэкенд, обслуживает `/api/login` и `/api/schedule`
- `data/` — runtime-данные на VPS (`schedule.json`, `tokens.json`); в гит не коммитится
- `deploy/` — конфиги nginx и systemd

## Локальная разработка

Фронт — открыть `web/index.html` в браузере или поднять `python3 -m http.server --directory web 8123`. Если нужно тестить API, запустить `cd api && npm install && node index.js` (порт 3002).

## Деплой

- `main` → `dobrypiter.pro`
- `dev` → `review.dobrypiter.pro`

На VPS:

```
ssh root@VPS deploy-dobrypiter-prod      # подтянуть main и обновить prod
ssh root@VPS deploy-dobrypiter-review    # подтянуть dev и обновить review
```

API-сервис: `systemctl restart dobrypiter-api` после изменений в `api/`.

## Учётные данные админки

Креды хранятся вне git — в файле `/etc/dobrypiter/api.env` на VPS. Systemd-юнит подключает его через `EnvironmentFile=`. Формат файла:

```
PORT=3002
DATA_DIR=/var/www/dobrypiter-pro/data
ADMIN_LOGIN=<логин>
ADMIN_PASSWORD_HASH=scrypt:<salt_hex>:<hash_hex>
```

Пароль хранится только в виде scrypt-хэша. Сгенерировать строку `ADMIN_PASSWORD_HASH=...` при смене пароля:

```
cd /var/www/dobrypiter-pro/api
node generate-password-hash.js '<новый пароль>'
```

Вывод скрипта вставить в `/etc/dobrypiter/api.env`, затем `systemctl restart dobrypiter-api`. Без заданных `ADMIN_LOGIN` и `ADMIN_PASSWORD_HASH` API не стартует.

Права на файл: `chmod 600 /etc/dobrypiter/api.env`.
