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

В env-vars systemd-сервиса (`/etc/systemd/system/dobrypiter-api.service`):

- `ADMIN_LOGIN`
- `ADMIN_PASSWORD`
