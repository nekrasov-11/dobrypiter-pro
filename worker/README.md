# Form Handler Worker

Cloudflare Worker, который принимает POST с формы записи и отправляет сообщение в Telegram-чат через бота.

## Деплой

### 1. Установить Wrangler

```bash
npm install -g wrangler
```

### 2. Залогиниться в Cloudflare

```bash
wrangler login
```

Откроется браузер. Если у тебя ещё нет аккаунта в Cloudflare — заведи. Можно через Google / GitHub, бесплатно.

### 3. Создать секреты с токеном бота и chat_id

```bash
cd worker
wrangler secret put TG_BOT_TOKEN
# Wrangler спросит значение — вставляешь токен от @BotFather

wrangler secret put TG_CHAT_ID
# Вставляешь chat_id целевого чата
```

Подробнее как получить эти значения — см. [TELEGRAM-SETUP.md](../TELEGRAM-SETUP.md) в корне репо.

### 4. Задеплоить

```bash
wrangler deploy
```

В выводе появится URL вида:

```
https://dobrypiter-form-handler.<твой-cf-логин>.workers.dev
```

Скопируй этот URL — он нужен для следующего шага.

### 5. Вставить URL в форму

Открой `web/index.html`, найди:

```html
<form class="signup-form" data-endpoint=""
```

И впиши URL Worker'а:

```html
<form class="signup-form" data-endpoint="https://dobrypiter-form-handler.<твой-cf-логин>.workers.dev"
```

Сохрани, закоммить, пушни в `dev` — на review задеплоится.

## Тестирование

После деплоя зайди на https://review.dobrypiter.pro/ (логин/пароль обычные), пролистай вниз до формы, отправь тестовую заявку — в Telegram-чат должно прилететь сообщение.

Если не прилетает:

1. Открой devtools → Network → отправь форму → посмотри ответ от Worker'а
2. `wrangler tail` в консоли — увидишь логи Worker'а в real-time
3. Проверь что секреты на месте: `wrangler secret list`

## Что под капотом

- CORS разрешён только для `dobrypiter.pro`, `www.dobrypiter.pro` и `review.dobrypiter.pro`
- Honeypot: если поле `website` заполнено — заявка молча игнорится (это бот)
- Валидация на стороне Worker'а: имя ≥ 2 символа, телефон/группа/согласие обязательны
- Длина полей обрезается (имя 100, телефон 30, группа 60, время 100, комментарий 1000)
- В Telegram отправляется через MarkdownV2 с экранированием спецсимволов
