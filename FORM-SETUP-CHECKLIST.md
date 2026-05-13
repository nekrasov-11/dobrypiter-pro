# Чек-лист подключения формы записи

Список шагов от начала до рабочей формы на проде. Делай по порядку, отмечай выполненное.

## Telegram

- [ ] **1. Создать бота через @BotFather**, сохранить `TG_BOT_TOKEN`
  ([TELEGRAM-SETUP.md, шаг 1](TELEGRAM-SETUP.md#шаг-1-создать-бота-через-botfather))

- [ ] **2. Получить `TG_CHAT_ID`** целевого чата (личка или группа)
  ([TELEGRAM-SETUP.md, шаг 2](TELEGRAM-SETUP.md#шаг-2-получить-chat_id-целевого-чата))

## Cloudflare Worker

- [ ] **3. Установить Wrangler CLI**
  ```
  npm install -g wrangler
  ```

- [ ] **4. Залогиниться в Cloudflare**
  ```
  cd worker
  wrangler login
  ```
  Если аккаунта нет — заведи на cloudflare.com (бесплатно, можно через Google).

- [ ] **5. Создать секреты**
  ```
  wrangler secret put TG_BOT_TOKEN
  wrangler secret put TG_CHAT_ID
  ```

- [ ] **6. Задеплоить Worker**
  ```
  wrangler deploy
  ```
  Скопируй URL из вывода (вида `https://dobrypiter-form-handler.<твой-логин>.workers.dev`).

## Подключить URL к форме

- [ ] **7. Вписать URL Worker'а в форму**
  В `web/index.html` найди:
  ```html
  <form class="signup-form" data-signup-form data-endpoint=""
  ```
  Впиши URL в `data-endpoint=""` и сохрани:
  ```html
  <form class="signup-form" data-signup-form data-endpoint="https://dobrypiter-form-handler.<твой-логин>.workers.dev"
  ```

- [ ] **8. Закоммитить и запушить**
  ```
  git add web/index.html
  git commit -m "Wire signup form endpoint"
  git push origin dev
  ```
  Затем на VPS:
  ```
  ssh root@212.113.118.22 deploy-dobrypiter-review
  ```

## Политика конфиденциальности

- [ ] **9. Заполнить плейсхолдеры в `web/privacy/index.html`**:
  - `[ДАТА_ОБНОВЛЕНИЯ]` — сегодняшняя дата
  - `[ИП_ИЛИ_ООО_ПОЛНОЕ_НАИМЕНОВАНИЕ]` — например, «ИП Иванов Иван Иванович»
  - `[ИНН]`, `[ОГРН]`, `[ЮРИДИЧЕСКИЙ_АДРЕС]`
  - `[EMAIL_ДЛЯ_ЗАПРОСОВ]` — почта для запросов по 152-ФЗ
  - `[СРОК_ХРАНЕНИЯ]` — обычно «1 год»

Перегенерация страниц не нужна (privacy написан вручную, не через шаблонизатор).

## Проверка

- [ ] **10. Открой `https://review.dobrypiter.pro/`** (логин/пароль обычные), пролистай до формы.

- [ ] **11. Отправь тестовую заявку** с заведомо своим именем и телефоном.

- [ ] **12. Убедись, что:**
  - В Telegram-чат прилетело сообщение
  - На сайте появился экран «Спасибо! Заявка отправлена.»
  - Кнопка «Отправить ещё одну заявку» возвращает форму

- [ ] **13. Проверь honeypot** — открой devtools, в форме найди скрытое поле `name="website"`, заполни любое значение, отправь форму. Заявка НЕ должна прийти в Telegram (молчаливо проглатывается как бот).

- [ ] **14. Проверь обработку ошибок** — временно сломай endpoint (например, поменяй на `https://example.com/`), отправь — должно показать «Что-то пошло не так. Напишите нам в Telegram: …». Верни обратно.

## Релиз на прод

После проверки на review:

- [ ] **15. Замёрджить `dev` → `main`** (или cherry-pick нужных коммитов).
  ```
  git checkout main
  git merge dev
  git push origin main
  ssh root@212.113.118.22 deploy-dobrypiter-prod
  ```

- [ ] **16. Проверь форму на проде** — `https://dobrypiter.pro/`, ещё раз отправь тестовую заявку.

## Что под капотом (если интересно)

- Форма на сайте просто делает `fetch POST` на URL Worker'а с JSON
- Worker валидирует, проверяет CORS (только наши домены), отправляет в Telegram через `api.telegram.org`
- Токен и chat_id хранятся как Cloudflare Secrets — не в git, не в коде сайта
- Honeypot (`name="website"`) скрыт CSS и попадается только ботам
- На клиенте — простая валидация имя/телефон, остальное — на стороне Worker'а
