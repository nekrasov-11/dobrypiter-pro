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

## Цены

Прайс правится в админке на вкладке «Цены». Источник истины — `data/prices.json` на VPS;
дефолтный прайс для первого запуска лежит в `api/prices.default.json`.

Страница `/tseny/` остаётся обычной статикой с настоящими ценами в разметке: при сохранении
в админке (и при старте API) `api/render-prices.js` подставляет значения прямо в HTML-файл.
Так цены видит поисковый робот — в отличие от расписания, которое подтягивается на клиенте.

Обновляются автоматически: таблица цен, блок с цифрами в hero, `<title>`, `description`,
og/twitter-описания, микроразметка `Offer` и `FAQPage`. Формулировки в абзацах
(склонения, «месяц с первой тренировки», количество тренировок в названии) правятся руками.

Как это устроено в разметке `web/tseny/index.html`:

- `<span data-price="adult.sub12">6000 ₽</span>` — подстановка значения.
  Ссылка `категория.позиция`, поддерживаются множитель (`adult.single*12`)
  и агрегаты по типу позиции (`min:sub` — «абонементы от …»).
  Флаги: `data-price-nb` — неразрывные пробелы (для прозы),
  `data-price-num` — печатать число, а не слово «бесплатно» для нулевой цены.
- `<title data-price-text="… {min:sub} …">` — текстовый шаблон; на `<meta>` подставляется в `content`.
- `<!-- prices:table:start --> … <!-- prices:table:end -->` — блок генерируется целиком.
  Так же устроены блоки `offers` и `faq`. Микроразметка `FAQPage` собирается из видимого FAQ
  (блок `faq-visible`), поэтому текст в разметке всегда дословно совпадает с текстом на странице.

**Важно при правках страницы цен.** Деплой делает `git reset --hard`, то есть откатывает
отрендеренный HTML к закоммиченной версии. Это безопасно: страница остаётся валидной со старыми
ценами, а API при рестарте перерендеривает её из `prices.json`. Но из этого следуют два правила:

1. После ручной правки `web/tseny/index.html` прогнать проверку — она должна быть чистой:

```
node api/render-prices.js --check
```

2. Review-деплой не рестартит API, поэтому рендер вызывается в самом скрипте деплоя
   (`/usr/local/bin/deploy-dobrypiter-review`). Каталоги, в которые пишет рендерер, задаёт
   переменная `RENDER_TARGETS` в `/etc/dobrypiter/api.env` (список через запятую,
   по умолчанию — `web/` рядом с `api/`).

Позицию, на которую ссылается текст страницы, удалить через админку нельзя: API делает пробный
рендер и возвращает понятную ошибку вместо того, чтобы испортить SEO-страницу.

Данные общие для прода и review — API один, из прод-чекаута. Правка цен в review-админке
меняет цены и на проде.

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
