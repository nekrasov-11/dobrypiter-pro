# ТЗ: переход dobrypiter.pro с одностраничника на мультистраничник

**Статус:** к исполнению · **Ветка работ:** `dev` (review.dobrypiter.pro) → после приёмки merge в `main` (прод)
**Репозиторий:** `/Users/denisnekrasov/Documents/Claude/dobrypiter-pro`

## 0. Цель и контекст

SEO-аудит показал: для выхода в топ Яндекса по кластерам запросов нужны отдельные
посадочные страницы. Создаём 5 страниц:

| URL | Рабочее название | H1 (примерный, финал даёт seo-manager) |
|---|---|---|
| `/boks-dlya-detey/` | Детская + подростковая группы | Бокс для детей в Санкт-Петербурге |
| `/boks-dlya-zhenshchin/` | Женская группа | Бокс для женщин в Санкт-Петербурге |
| `/boks-dlya-vzroslyh/` | Взрослая группа | Бокс для взрослых в Санкт-Петербурге |
| `/individualnye-trenirovki/` | Персональные занятия | Индивидуальные тренировки по боксу |
| `/tseny/` | Цены на все группы | Цены на тренировки по боксу |

Главная страница НЕ переносится и НЕ переделывается (кроме навигации и перелинковки, см. §6).

**Как устроен проект (для сессий без контекста):**
- `web/` — статичный HTML/CSS/JS, без сборки, без фреймворков. Nginx отдаёт файлы напрямую.
- Nginx (`deploy/dobrypiter.pro.nginx:17-19`): `try_files $uri $uri/ =404` + `index index.html`
  — подкаталог с `index.html` работает из коробки, ничего в nginx менять НЕ нужно.
  Пример существующего подкаталога: `web/privacy/`.
- Деплой: push в `main` → dobrypiter.pro, push в `dev` → review.dobrypiter.pro.
- Форма заявок: Cloudflare Worker (`worker/worker.js`) → Telegram.
- Расписание: админка пишет в API (`/api/schedule`), `web/script.js:2-33` подменяет статичный HTML.

**⚠️ Не брать за образец `web/privacy/index.html`!** Она свёрстана на классах старого
(светлого) дизайна (`site-header`, `subpage-hero`, `prose`, `footer-grid`, `fab-stack`),
которых нет в актуальном `web/style.css`. Privacy — пример только структуры каталога.
Образец разметки — всегда `web/index.html`.

---

## 1. Файловая структура

- [ ] Каждая страница — подкаталог с одним `index.html`:
  ```
  web/
  ├── index.html                       (главная — существует)
  ├── boks-dlya-detey/index.html
  ├── boks-dlya-zhenshchin/index.html
  ├── boks-dlya-vzroslyh/index.html
  ├── individualnye-trenirovki/index.html
  └── tseny/index.html
  ```
- [ ] Канонический URL — с завершающим слэшом: `https://dobrypiter.pro/tseny/`.
  Во всех внутренних ссылках, canonical, og:url и sitemap писать только со слэшом
  (`/tseny/`, не `/tseny`). Nginx сам сделает 301 `/tseny` → `/tseny/` (стандартное
  поведение `$uri/` + index).
- [ ] Новые ассеты (фото для hero подстраниц, если понадобятся) — в общий `web/assets/`,
  сжатые (ориентир: страничные JPEG ≤ 300 КБ, см. коммит `3699ce6`).

## 2. Пути к ресурсам — корневые абсолютные

Страницы лежат на 1 уровень глубже корня. Чтобы разметку можно было копировать между
страницами без переписывания путей, **все ссылки на общие ресурсы — абсолютные от корня**
(так уже сделано в `web/privacy/index.html:11-14`, и это надёжнее, чем `../`):

- [ ] `<link rel="stylesheet" href="/style.css?v=...">`
- [ ] `<script src="/script.js?v=..."></script>`
- [ ] `<img src="/assets/logo.png">`, `/assets/*.jpg`, `/favicon.png`
- [ ] Ссылки на главную и её якоря: `/`, `/#schedule`, `/#coach` и т.п.

Внимание: в самой `web/index.html` пути сейчас относительные (`style.css`, `assets/logo.png`
— строки 112-115, 121, 392). Для главной это работает и менять их НЕ нужно. Но при
копировании блоков из index.html на подстраницы — заменить все относительные пути
на корневые (`assets/` → `/assets/`, `style.css` → `/style.css`, `script.js` → `/script.js`,
`#contacts` в навигации остаётся якорем, т.к. секция контактов есть на каждой странице).

Шрифты в `style.css` (`url('assets/fonts/...')`, строки 6-37) резолвятся относительно
самого CSS-файла (`/style.css` → `/assets/fonts/`) — работают на любой глубине, не трогать.

Кэш-версия: у `style.css` и `script.js` на главной стоит `?v=20260803a`
(`index.html:115, 392`). На новых страницах использовать ту же актуальную версию;
при любом изменении style.css/script.js — поднимать `?v=` синхронно во ВСЕХ 6 html.

## 3. Шаблон подстраницы (скелет)

Блоки копируются из `web/index.html` (номера строк — по состоянию на коммит `b65b50e`).

### 3.1 `<head>` — копировать с главной и адаптировать

- [ ] `charset`, `viewport` — как есть (`index.html:4-5`).
- [ ] Скрипт review-окружения `window.__IS_REVIEW__` — копия `index.html:8-23` без изменений.
- [ ] `<title>` — уникальный для страницы (даёт seo-manager). Шаблон:
  `Бокс для детей в Санкт-Петербурге — клуб «Добрый Питер», м. Лесная`.
- [ ] `<meta name="description">` — уникальный (seo-manager).
- [ ] `<link rel="canonical" href="https://dobrypiter.pro/boks-dlya-detey/">` — свой у каждой.
- [ ] OG-теги — копия блока `index.html:28-41`, но `og:title`/`og:description` — свои,
  `og:url` = canonical. `og:image` пока общий `https://dobrypiter.pro/assets/og-image.jpg`.
- [ ] JSON-LD — см. §7.
- [ ] Счётчик Яндекс.Метрики — копия `index.html:96-110` без изменений (обёртка
  `if (!window.__IS_REVIEW__)` уже отключает его на review).
- [ ] favicon: `<link rel="icon" type="image/png" href="/favicon.png">` +
  apple-touch-icon (пути корневые!).
- [ ] `<link rel="stylesheet" href="/style.css?v=...">`.

### 3.2 `<body>` — порядок секций

1. **Шапка** — копия `<nav class="site-nav">` (`index.html:119-130`) с правками:
   - логотип ведёт на `/` (не `#top`), src `/assets/logo.png`;
   - пункты меню — см. §6;
   - `nav-btn` «Пробное занятие» остаётся `href="#contacts" data-scroll-form`
     (форма есть на каждой странице).
2. **Hero упрощённый — БЕЗ видео.** Переиспользуем сетку `.hero`:
   ```html
   <section class="hero">
       <div class="hero-left">
           <div>
               <div class="hero-tag">Бокс · Санкт-Петербург</div>
               <h1 class="hero-title"><span class="line-white">Бокс</span><span class="line-red">для детей</span></h1>
               <p class="hero-desc">[1-2 предложения от seo-manager/content-editor]</p>
               <a class="btn-red" href="#contacts" data-scroll-form>Записаться на пробное</a>
           </div>
           <div class="hero-meta"> … 2-3 блока .hm-block с цифрами страницы … </div>
       </div>
       <div class="hero-right">
           <img src="/assets/[фото].jpg" alt="[осмысленный alt]" fetchpriority="high">
       </div>
   </section>
   ```
   `.hero-right img` уже застилен (`style.css:239-246`), ничего добавлять не нужно.
   Кнопку звука и `<video>` НЕ копировать. H1 — ровно один на страницу.
3. **Контентные секции** — 2-4 секции `<section class="section">` с `<h2 class="sec-title">`:
   описание группы/услуги, кому подходит, как проходит тренировка, FAQ. Тексты — от
   content-editor/seo-manager; исполнитель этого ТЗ ставит каркас с черновым текстом.
   Для «фактов» использовать готовую сетку чипов `.about-nums` > `.an` (см. §4).
4. **Расписание группы** — карточка(и) `.sch-card` только своей группы + фильтр из API,
   см. §5.2. Для `/tseny/` — расписание не обязательно, вместо него блок цен.
5. **Цены** (на каждой странице — цены своей группы, на `/tseny/` — все):
   вёрстка на сетке `.sch-grid`/`.sch-card` (название группы, стоимость, `.sch-badge`
   с примечанием) — новые классы, скорее всего, не нужны. Если нужны — §4.
6. **Контакты + форма** — копия секции `#contacts` целиком (`index.html:312-382`)
   с корневыми путями. Внутри: карта (iframe Яндекса), форма (`data-signup-form`),
   success-блок. В форме селект «Группа» можно предвыбрать группу страницы:
   у нужного `<option>` поставить `selected` (и убрать `selected` у placeholder).
7. **Футер** — копия `index.html:384-390` + блок перелинковки, см. §6.
8. `<script src="/script.js?v=..."></script>` перед `</body>`.

## 4. Стили

- [ ] Все страницы подключают общий `/style.css?v=...`. Отдельных CSS-файлов НЕ создавать.
- [ ] Инлайн-стили запрещены (кроме уже существующих паттернов, например noscript метрики).
- [ ] Новые классы — только если реально не хватает существующих. Добавлять строго
  в конец `web/style.css` под комментарием-секцией:
  ```css
  /* ===== Subpages (мультистраничник, ТЗ 00) ===== */
  ```
  и с мобильными правками в этом же блоке (`@media (max-width: 900px)` / `600px`).

**Готовые классы дизайн-системы (реальные имена из style.css):**

| Что нужно | Классы | Где в style.css |
|---|---|---|
| Шапка | `.site-nav`, `.logo`, `.nav-links`, `.nav-btn` | 79-154 |
| Кнопки | `.btn-red` (CTA), `.btn-submit` (форма) | 121-137, 695-713 |
| Hero-сетка | `.hero`, `.hero-left`, `.hero-right`, `.hero-tag`, `.hero-title` (`.line-white`/`.line-red`), `.hero-desc`, `.hero-meta` > `.hm-block` (`.hm-num`, `.hm-label`) | 157-246 |
| Секция + заголовок | `.section`, `.sec-title` (h2, с линией-хвостом) | 299-332 |
| Текст в 2 колонки | `.about-grid`, `.about-text` | 335-346 |
| Сетка чипов-фактов | `.about-nums` > `.an` (`.an-num`, `.an-label`) | 348-382 |
| Карточки расписания/цен | `.sch-grid` > `.sch-card` (`.sch-card-title`, `.sch-row`, `.sch-day`, `.sch-time`, `.sch-badge`) | 417-464 |
| Чипы с заголовком | `.coach-badges` > `.coach-badge` (`.cb-head`, `.cb-text`) | 497-531 |
| Отзывы | `.reviews-grid` > `.rev-card` (`.rev-text`, `.rev-author`), карусель `[data-reviews-carousel]` | 539-594 |
| Контакты + форма | `.contact-grid`, `.contact-left/right`, `.contact-title` (`.accent`), `.cd-grid` (`.cd-label`, `.cd-val`), `.signup-form`, `.form-field`, `.form-label`, `.form-honeypot`, `.form-status`, `.signup-success` | 596-771 |
| Футер | `.site-footer`, `.foot-copy`, `.foot-links` | 773-800 |
| Видимость | `.desktop-only`, `.mobile-only`, `.sr-only` | 802-817 |
| CSS-переменные | `--bg`, `--bg2`, `--bg3`, `--white`, `--gray`, `--lgray`, `--accent`, `--pad`, `--content-max` | 42-53 |

Внимание: `.sch-grid` на десктопе — жёсткие `repeat(5, 1fr)` (style.css:419). Для блока
из 1-2 карточек на подстранице это даст узкие карточки. Решение без правки базового
класса — модификатор в новой секции CSS, например:
`.sch-grid--narrow { grid-template-columns: repeat(auto-fit, minmax(240px, 320px)); }`.

## 5. JavaScript

### 5.1 Что из `web/script.js` нужно подстраницам и что с ним будет

`script.js` — одна IIFE, все блоки защищены проверками наличия DOM-узлов.
Построчный разбор на предмет «упадёт ли на подстранице»:

| Блок | Строки | Поведение на подстранице | Действие |
|---|---|---|---|
| Расписание из API | 2-33 | `if (grid)` — без `#schedule-grid` просто пропустится | Нужен фильтр по группе — см. §5.2 |
| Карусель отзывов | 42-121 | `querySelectorAll` → пусто, не выполнится | Ничего; если на страницу добавят отзывы — заработает само |
| Форма заявки | 124-236 | `if (!form || !submit || !formView || !successView) return;` (стр. 133) — работает при наличии формы | Копируем секцию контактов → работает. Доработка payload — §5.3 |
| CTA `data-scroll-form` | 239-252 | `document.getElementById("contacts")` — секция есть на каждой странице, скролл и цель `form_open` работают | Ничего |
| Reveal-on-scroll (мобайл) | 260-317 | `querySelectorAll('.sch-grid, .about-nums, .coach-badges')` → работает с любыми найденными группами | Ничего |
| Звук hero-видео | 319-336 | `if (video && toggle)` — на страницах без видео пропустится | Ничего |

**Вывод: жёстких завязок на главную, роняющих скрипт, нет. Подключаем тот же
`/script.js` на все страницы.** Единственные правки — §5.2 и §5.3.

### 5.2 Фильтр расписания по группе (правка script.js)

Проблема: если на подстранице поставить `id="schedule-grid"`, `renderSchedule`
(script.js:17-33) затрёт карточку и отрисует ВСЕ 5 групп из API.

- [ ] Решение — атрибут-фильтр на контейнере подстраницы:
  ```html
  <div class="sch-grid sch-grid--narrow" id="schedule-grid" data-schedule-groups="Детская группа,Подростковая">
      … статичная копия карточек этих групп из index.html:197-210 (фолбэк, если API лёг) …
  </div>
  ```
- [ ] В `renderSchedule` (script.js:17-19) добавить фильтрацию:
  ```js
  function renderSchedule(target, data) {
      let groups = (data && Array.isArray(data.groups)) ? data.groups : [];
      const filterAttr = target.getAttribute("data-schedule-groups");
      if (filterAttr) {
          const wanted = filterAttr.split(",").map(function (s) { return s.trim().toLowerCase(); });
          groups = groups.filter(function (g) {
              return wanted.indexOf(String(g.name || "").trim().toLowerCase()) !== -1;
          });
      }
      if (!groups.length) return;   // фильтр ничего не нашёл — оставляем статичный HTML
      ...
  ```
  Главная без атрибута работает как раньше. Если админ переименует группу в админке
  — фильтр не совпадёт и останется статичный фолбэк (не падение, но данные устареют;
  зафиксировать имена групп в комментарии в html).
- [ ] Соответствие страниц группам API: детская → «Детская группа» + «Подростковая»,
  женская → «Женская группа», взрослая → «Взрослая группа», индивидуальные →
  «Индивидуально». Сверить точные имена с ответом `GET /api/schedule` на review.

### 5.3 Источник заявки (правка script.js)

- [ ] В payload формы (script.js:208-214) добавить страницу-источник — без правки HTML форм:
  ```js
  page: location.pathname,   // "/", "/boks-dlya-detey/", …
  ```
  (Вариант со скрытым `<input name="page">` не нужен — pathname надёжнее и не
  требует править 6 форм.)

## 6. Навигация и перелинковка

### 6.1 Шапка

В мобильной вёрстке нет бургер-меню: `.nav-links` просто переносится третьей строкой
(`style.css:843-849`). 4 текущих пункта + кнопка — предел по ширине. Поэтому НЕ пихаем
все 5 страниц в шапку.

- [ ] **Главная** (`index.html:123-128`): добавить один пункт
  `<li><a href="/tseny/">Цены</a></li>` (после «Расписание»). Проверить, что на 360px
  меню не разваливается; при тесноте — сократить «Расписание» до «График» или уменьшить
  `letter-spacing` в медиа-запросе 600px (style.css:985-986).
- [ ] **Подстраницы** — шапка с пунктами:
  `Главная (/)` · `Расписание (#schedule — своя секция; на /tseny/ → /#schedule)` ·
  `Цены (/tseny/; на самой /tseny/ пункт опустить)` · `Контакты (#contacts)`
  + `nav-btn` «Пробное занятие» → `#contacts`.

### 6.2 Футер — основная перелинковка (на всех 6 страницах)

- [ ] Расширить футер (`index.html:384-390`) блоком направлений. Разметка без новых
  классов — вторая строка `.foot-links`, либо (лучше для мобилки) новый блок в секции
  `/* ===== Subpages ===== */`:
  ```html
  <footer class="site-footer">
      <span class="foot-copy">© Боксёрский клуб «Добрый Питер»</span>
      <nav class="foot-links foot-links--pages" aria-label="Разделы сайта">
          <a href="/boks-dlya-detey/">Бокс для детей</a>
          <a href="/boks-dlya-zhenshchin/">Бокс для женщин</a>
          <a href="/boks-dlya-vzroslyh/">Бокс для взрослых</a>
          <a href="/individualnye-trenirovki/">Индивидуальные тренировки</a>
          <a href="/tseny/">Цены</a>
      </nav>
      <div class="foot-links">
          <a href="https://vk.com/dobryipiter" …>ВКонтакте</a>
          <a href="https://t.me/nekrasov_valeriy" …>Telegram</a>
      </div>
  </footer>
  ```
  Футер одинаковый на всех 6 страницах (на текущей странице её собственную ссылку
  можно оставить — не критично).
- [ ] Ссылку на текущую страницу в футере допустимо не убирать (упрощает копипасту).

### 6.2 Контентная перелинковка

- [ ] На главной под сеткой расписания (`index.html`, после строки 231, внутри секции
  `#schedule`) добавить абзац-строку ссылок на 4 страницы групп + цены (текст даст
  seo-manager; технически — простые `<a>` в `<p>`). НЕ вешать ссылки внутрь
  `#schedule-grid` — их сотрёт `renderSchedule`.
- [ ] На каждой подстранице — 1-2 контекстные ссылки на соседние страницы и на `/tseny/`.

## 7. SEO-техника

- [ ] **Canonical:** у каждой страницы свой, абсолютный, со слэшом (§3.1). На главной
  остаётся `https://dobrypiter.pro/` (`index.html:26`).
- [ ] **sitemap.xml** (`web/sitemap.xml`) — все 6 URL:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://dobrypiter.pro/</loc><lastmod>[дата правки навигации]</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
      <url><loc>https://dobrypiter.pro/boks-dlya-detey/</loc><lastmod>[дата публикации]</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
      <url><loc>https://dobrypiter.pro/boks-dlya-zhenshchin/</loc>…</url>
      <url><loc>https://dobrypiter.pro/boks-dlya-vzroslyh/</loc>…</url>
      <url><loc>https://dobrypiter.pro/individualnye-trenirovki/</loc>…</url>
      <url><loc>https://dobrypiter.pro/tseny/</loc>…</url>
  </urlset>
  ```
  lastmod — реальная дата публикации каждой страницы (формат YYYY-MM-DD).
- [ ] **robots.txt** — НЕ трогать (уже `Allow: /`, `Disallow: /admin/ /api/`, sitemap указан).
- [ ] **JSON-LD на подстраницах** — `Service` со ссылкой на организацию главной через `@id`
  (`https://dobrypiter.pro/#org` объявлен в `index.html:47`). Минимальный каркас:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Бокс для детей",
    "serviceType": "Тренировки по боксу для детей",
    "url": "https://dobrypiter.pro/boks-dlya-detey/",
    "areaServed": { "@type": "City", "name": "Санкт-Петербург" },
    "provider": { "@id": "https://dobrypiter.pro/#org" }
  }
  ```
  На `/tseny/` дополнительно `Offer`/`offers` с ценами. Детализацию (описания,
  offers, возможно BreadcrumbList) даёт seo-manager отдельным ТЗ — здесь только каркас.
- [ ] Метрика: тот же счётчик 108780081 на всех страницах (цели `form_open`/`form_submit`
  уже шлются из общего script.js, страница различается автоматически по URL визита).

## 8. Форма заявки на подстраницах (worker)

Форма копируется из `index.html:329-379` целиком (endpoint в `data-endpoint` тот же
Worker: `https://dobrypiter-form-handler.nekrasov-smotra.workers.dev`). CORS в Worker
проверяет только Origin (`worker/worker.js:53`) — для новых путей на том же домене
ничего менять не надо.

Правка `worker/worker.js`, чтобы в Telegram было видно страницу-источник:

- [ ] После строки 72 (`const comment = …`) добавить:
  ```js
  const page = clean(data && data.page, 100);
  ```
- [ ] Строку 90 (`'🌐 _Источник: …'`) заменить на:
  ```js
  '🌐 _Источник: ' + escapeMarkdown(source + (page ? ' · ' + page : '')) + '_';
  ```
  Поле опциональное — старые клиенты/кэш без `page` продолжают работать.
- [ ] Задеплоить Worker: `cd worker && npx wrangler deploy` (см. `worker/README.md`).
  Worker деплоится отдельно от сайта — выкатить ДО публикации страниц (обратная
  совместимость это позволяет).

## 9. Чем НЕ заниматься

- Никаких сборщиков, бандлеров, шаблонизаторов, SSI/includes, npm-зависимостей для web/.
  Дублирование шапки/футера в 6 файлах — осознанная цена простоты.
- Не переносить/не редизайнить главную (кроме пункта меню, ссылок под расписанием и футера).
- Не трогать `web/admin/`, `api/`, nginx-конфиг, `robots.txt`.
- Не переделывать `web/privacy/` (отдельная задача, откат `b65b50e`).
- Не создавать отдельные CSS/JS-файлы на страницу.
- Не добавлять бургер-меню «заодно» — только если 5-й пункт реально ломает шапку
  на 360px, и тогда это отдельное согласование.

## 10. Порядок работ

**Этап 0 — подготовка (до вёрстки):**
- [ ] Получить у владельца актуальные цены всех групп — без них `/tseny/` не собрать. **Блокер.**
- [ ] Получить тексты/мета от content-editor и seo-manager (title, description, H1,
  тексты секций). Если текстов нет — верстать каркас с черновиками и пометкой TODO.
- [ ] Сверить имена групп с `GET https://review.dobrypiter.pro/api/schedule`.

**Этап 1 — общие правки кода:**
- [ ] `web/script.js`: фильтр расписания (§5.2) + `page` в payload (§5.3). Поднять `?v=`
  в `index.html`.
- [ ] `worker/worker.js`: поле `page` (§8), задеплоить Worker.
- [ ] Проверить на review, что главная работает как раньше (расписание, форма, заявка
  в Telegram приходит с `· /`).

**Этап 2 — пилот `/tseny/`:**
- [ ] Сверстать `web/tseny/index.html` по §3 (это самая нестандартная страница — без
  расписания-фильтра, с сеткой цен; хорошо обкатывает шаблон).
- [ ] Прогнать чеклист проверки (§11) на review.dobrypiter.pro/tseny/.
- [ ] QA + code-review. Зафиксировать замечания к шаблону, чтобы не тиражировать ошибки.

**Этап 3 — остальные 4 страницы** (по одной, каждая — отдельный коммит):
- [ ] `/boks-dlya-vzroslyh/` → чеклист §11
- [ ] `/boks-dlya-detey/` → чеклист §11
- [ ] `/boks-dlya-zhenshchin/` → чеклист §11
- [ ] `/individualnye-trenirovki/` → чеклист §11

**Этап 4 — связка и выкат:**
- [ ] Навигация и перелинковка на главной (§6), футер на всех страницах.
- [ ] `sitemap.xml` — 6 URL с lastmod (§7).
- [ ] Финальный QA всего сайта на review → merge `dev` → `main`.
- [ ] После выката на прод: отправить новые URL на переобход в Яндекс.Вебмастере,
  проверить sitemap там же (зона seo-manager).

## 11. Чеклист проверки каждой страницы (на review.dobrypiter.pro)

- [ ] Страница открывается по URL со слэшом; `/url` без слэша → 301 на `/url/`.
- [ ] Консоль браузера чистая: нет 404 по css/js/картинкам/шрифтам, нет JS-ошибок.
- [ ] Мобильная вёрстка: 360px, 393px (iPhone 15 Pro), 768px — шапка не разваливается,
  hero-фото не растянуто, карточки расписания/цен в одну колонку, футер читается.
- [ ] Десктоп ≥1240px: контент центрирован (переменная `--pad`), сетки не пустуют.
- [ ] Форма: заполнение → заявка приходит в Telegram с правильным «Источник: … · /stranitsa/»;
  success-блок показывается; honeypot-поле скрыто; предвыбранная группа корректна.
- [ ] Кнопки `data-scroll-form` скроллят к форме, фокус попадает в поле «Имя».
- [ ] Расписание: при живом API показываются только группы страницы; при отключённом
  API (проверить, временно указав неверное имя в data-schedule-groups) — статичный фолбэк.
- [ ] SEO-теги: уникальные title/description, canonical без опечаток, og:url = canonical,
  ровно один H1.
- [ ] Schema: валидация JSON-LD в https://validator.schema.org/ (и «Проверка микроразметки»
  Яндекс.Вебмастера) — без ошибок; `provider.@id` указывает на `https://dobrypiter.pro/#org`.
- [ ] Метрика НЕ грузится на review (снипет `__IS_REVIEW__` на месте), favicon на review
  подменён на 🔴.
- [ ] Ссылки шапки/футера ведут куда надо, битых внутренних ссылок нет.

## 12. Definition of Done (по каждой странице)

Страница считается готовой, когда:

1. Файл `web/<slug>/index.html` в `dev`, доступен на `https://review.dobrypiter.pro/<slug>/`.
2. Пройден весь чеклист §11, замечания QA закрыты.
3. Уникальные title, description, H1, canonical; JSON-LD `Service` валиден.
4. Все пути к общим ресурсам корневые (`/style.css`, `/script.js`, `/assets/...`),
   версия `?v=` совпадает с остальными страницами.
5. Форма реально доставляет заявку в Telegram с пометкой страницы-источника.
6. Расписание страницы подтягивается из API (кроме `/tseny/`), фолбэк-разметка актуальна.
7. Новые CSS-правила (если есть) — только в секции `/* ===== Subpages ===== */` в конце
   `style.css`, с мобильными медиа-правками.
8. Страница добавлена в `sitemap.xml` с корректным lastmod и в футерную перелинковку.
9. Нет изменений в файлах вне объёма ТЗ (admin, api, nginx, robots, privacy).

## 13. Риски

| Риск | Митигация |
|---|---|
| Нет утверждённых цен → `/tseny/` встанет | Этап 0, эскалация владельцу до начала вёрстки |
| Переименование группы в админке ломает фильтр расписания | Фолбэк на статичную разметку уже в решении §5.2; комментарий в html с точными именами |
| Рассинхрон `?v=` между 6 файлами → старый CSS у части страниц | Правило «поднимаем во всех 6 сразу», проверка в code-review |
| Дублирование шапки/футера → правки навигации надо тиражировать руками в 6 файлов | Зафиксировано как осознанная цена (§9); при правках навигации — grep по `web/*/index.html` |
| 5-й пункт меню ломает мобильную шапку (нет бургера) | Проверка на 360px в §11; план Б в §6.1 |
| Подстраницы каннибализируют запросы главной | Уникальные title/H1 от seo-manager, canonical у каждой страницы свой |
| renderSchedule затирает перелинковку, если ссылки положить в #schedule-grid | Запрет в §6.2: ссылки только вне контейнера |
