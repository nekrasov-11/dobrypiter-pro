'use strict';

// Рендер цен в статические страницы.
//
// Источник истины — data/prices.json (правится через админку). Страница остаётся
// обычной статикой с настоящими ценами в разметке: рендерер подставляет значения
// на место, а не собирает HTML с нуля. Поэтому цены видит поисковый робот, а при
// `git reset --hard` во время деплоя страница откатывается к закоммиченным ценам,
// а не пропадает.
//
// Три механизма:
//   1. <span data-price="adult.sub12">6000 ₽</span>   — подстановка значения
//   2. <title data-price-text="... {min:sub} ...">    — текстовый шаблон
//   3. <!-- prices:offers:start --> … :end -->        — блок генерируется целиком
//
// Флаги на data-price: data-price-nb — неразрывные пробелы (для прозы),
// data-price-num — игнорировать текстовую подпись («бесплатно») и печатать число.

const fs = require('fs');
const path = require('path');

const PAGES = ['tseny/index.html'];

function RenderError(message) {
  const err = new Error(message);
  err.name = 'RenderError';
  err.isRenderError = true;
  return err;
}

// --- утилиты ---

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// JSON.stringify не экранирует «<», поэтому строка вида «</script>» разорвала бы
// блок ld+json. \u003c — валидный JSON-эскейп, содержимое от этого не меняется.
function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&mdash;': '—', '&ndash;': '–',
  '&laquo;': '«', '&raquo;': '»',
};

function decodeEntities(s) {
  return String(s).replace(/&[a-z]+;/gi, function (m) {
    return Object.prototype.hasOwnProperty.call(ENTITIES, m) ? ENTITIES[m] : m;
  });
}

function formatPrice(value, nb) {
  const sp = nb ? '&nbsp;' : ' ';
  let digits = String(value);
  if (value >= 10000) digits = digits.replace(/\B(?=(\d{3})+(?!\d))/g, sp);
  return digits + sp + '₽';
}

// --- разрешение ссылок на цены ---

function buildIndex(prices) {
  const index = new Map();
  prices.categories.forEach(function (cat) {
    cat.items.forEach(function (item) {
      index.set(cat.id + '.' + item.id, item);
    });
  });
  return index;
}

// Поддерживаются ссылки вида `adult.sub12`, `adult.single*12` и `min:sub` / `max:sub`
// (агрегат по всем позициям с таким kind — для формулировок «абонементы от 5000 ₽»).
function resolveRef(ref, prices, index) {
  const m = /^([a-z0-9_.:-]+?)(?:\*(\d+))?$/i.exec(String(ref).trim());
  if (!m) throw RenderError('Непонятная ссылка на цену: «' + ref + '»');
  const base = m[1];
  const mult = m[2] ? parseInt(m[2], 10) : 1;

  if (base.indexOf(':') !== -1) {
    const parts = base.split(':');
    const fn = parts[0];
    const kind = parts[1];
    const values = [];
    prices.categories.forEach(function (cat) {
      cat.items.forEach(function (item) { if (item.kind === kind) values.push(item.price); });
    });
    if (!values.length) {
      throw RenderError('На странице есть формулировка, которая считается по позициям типа «' +
        kind + '», но таких позиций в прайсе не осталось');
    }
    if (fn !== 'min' && fn !== 'max') throw RenderError('Непонятная ссылка на цену: «' + ref + '»');
    const price = fn === 'min' ? Math.min.apply(null, values) : Math.max.apply(null, values);
    return { price: price * mult, item: null };
  }

  const item = index.get(base);
  if (!item) {
    throw RenderError('Позиция «' + base + '» используется в тексте страницы, её нельзя удалить или переименовать');
  }
  return { price: item.price * mult, item: mult === 1 ? item : null };
}

// Бесплатная позиция на странице выглядит как «бесплатно», а не «0 ₽»
// (кроме мест с data-price-num — в блоке под заголовком нужна именно цифра).
function priceLabel(price, opts) {
  if (price === 0 && !opts.num) return 'бесплатно';
  return formatPrice(price, opts.nb);
}

function renderRef(ref, prices, index, opts) {
  const resolved = resolveRef(ref, prices, index);
  return priceLabel(resolved.price, opts);
}

function renderTemplate(tpl, prices, index) {
  return decodeEntities(tpl).replace(/\{([^}]+)\}/g, function (_, ref) {
    // В шаблонах (title, description) — обычные пробелы: значения попадают
    // в мета-теги, где неразрывные пробелы не нужны.
    return renderRef(ref, prices, index, { nb: false, num: false });
  });
}

// --- механизм 1: значения в data-price ---

const PRICE_EL_RE = /(<([a-z0-9]+)((?:[^>]*?)\sdata-price="([^"]+)"(?:[^>]*?))>)([\s\S]*?)(<\/\2>)/gi;

function applyPriceElements(html, prices, index) {
  return html.replace(PRICE_EL_RE, function (full, open, tag, attrs, ref) {
    const value = renderRef(ref, prices, index, {
      nb: attrs.indexOf('data-price-nb') !== -1,
      num: attrs.indexOf('data-price-num') !== -1,
    });
    return open + value + '</' + tag + '>';
  });
}

// --- механизм 2: текстовые шаблоны ---

const META_TPL_RE = /<meta((?:[^>]*?)\sdata-price-text="([^"]*)"(?:[^>]*?))>/gi;
const EL_TPL_RE = /(<(title|span|p|div|h1|h2|h3|li)((?:[^>]*?)\sdata-price-text="([^"]*)"(?:[^>]*?))>)([\s\S]*?)(<\/\2>)/gi;

function applyTextTemplates(html, prices, index) {
  html = html.replace(META_TPL_RE, function (full, attrs, tpl) {
    const value = escapeHtml(renderTemplate(tpl, prices, index));
    if (!/\scontent="/i.test(attrs)) throw RenderError('У <meta data-price-text> нет атрибута content');
    return '<meta' + attrs.replace(/(\scontent=")[^"]*(")/i, '$1' + value + '$2') + '>';
  });
  html = html.replace(EL_TPL_RE, function (full, open, tag, attrs, tpl) {
    return open + escapeHtml(renderTemplate(tpl, prices, index)) + '</' + tag + '>';
  });
  return html;
}

// --- примечание под таблицей ---

const NOTE_RE = /(<span\s[^>]*data-price-note[^>]*>)([\s\S]*?)(<\/span>)/i;

// Примечание владелец пишет обычным текстом, без вёрстки: короткие предлоги
// сами приклеиваем к следующему слову, чтобы не висли в конце строки.
function typographNote(s) {
  return s.replace(/(^|[\s(])([а-яёa-z]{1,2}) (?=[^\s])/gi, '$1$2&nbsp;');
}

function applyNote(html, prices) {
  if (typeof prices.note !== 'string') return html;
  return html.replace(NOTE_RE, function (full, open, _old, close) {
    return open + typographNote(escapeHtml(prices.note)) + close;
  });
}

// --- механизм 3: блоки целиком ---

function replaceBlock(html, name, content) {
  const start = '<!-- prices:' + name + ':start -->';
  const end = '<!-- prices:' + name + ':end -->';
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i === -1 || j === -1 || j < i) {
    throw RenderError('На странице не найдены маркеры блока «' + name + '»');
  }
  return html.slice(0, i + start.length) + content + html.slice(j);
}

function readBlock(html, name) {
  const start = '<!-- prices:' + name + ':start -->';
  const end = '<!-- prices:' + name + ':end -->';
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i === -1 || j === -1 || j < i) {
    throw RenderError('На странице не найдены маркеры блока «' + name + '»');
  }
  return html.slice(i + start.length, j);
}

function offerName(cat, item) {
  return cat.schemaGroup ? item.name + ', ' + cat.schemaGroup : item.name;
}

function buildOffersBlock(prices) {
  const offers = [];
  prices.categories.forEach(function (cat) {
    cat.items.forEach(function (item) {
      offers.push('          {"@type": "Offer", "name": ' + jsonForScript(offerName(cat, item)) +
        ', "price": "' + item.price + '", "priceCurrency": "RUB"}');
    });
  });
  return '\n    <script type="application/ld+json">\n' +
    '    {\n' +
    '      "@context": "https://schema.org",\n' +
    '      "@type": "Service",\n' +
    '      "name": "Тренировки по боксу",\n' +
    '      "serviceType": "Секция бокса",\n' +
    '      "url": "https://dobrypiter.pro/tseny/",\n' +
    '      "areaServed": {"@type": "City", "name": "Санкт-Петербург"},\n' +
    '      "provider": {"@id": "https://dobrypiter.pro/#org"},\n' +
    '      "hasOfferCatalog": {\n' +
    '        "@type": "OfferCatalog",\n' +
    '        "name": "Цены на тренировки по боксу",\n' +
    '        "itemListElement": [\n' +
    offers.join(',\n') + '\n' +
    '        ]\n' +
    '      }\n' +
    '    }\n' +
    '    </script>\n    ';
}

function buildTableBlock(prices) {
  const cards = prices.categories.map(function (cat) {
    const rows = cat.items.map(function (item) {
      const value = priceLabel(item.price, { nb: false, num: false });
      return '            <div class="sch-row"><span class="sch-day">' + escapeHtml(item.name) +
        '</span><span class="sch-time">' + value + '</span></div>';
    });
    const badge = cat.badge
      ? '\n            <span class="sch-badge">' + escapeHtml(cat.badge) + '</span>'
      : '';
    return '        <article class="sch-card">\n' +
      '            <h3 class="sch-card-title">' + escapeHtml(cat.title) + '</h3>\n' +
      rows.join('\n') + badge + '\n' +
      '        </article>';
  });
  return '\n    <div class="sch-grid sch-grid--prices">\n' + cards.join('\n\n') + '\n    </div>\n    ';
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

// FAQPage собирается из видимого FAQ, а не из отдельного списка вопросов:
// тогда текст в микроразметке дословно совпадает с текстом на странице,
// а цены внутри ответов уже подставлены механизмом 1.
function buildFaqBlock(html) {
  const visible = readBlock(html, 'faq-visible');
  const entries = [];
  const badgeRe = /<div class="coach-badge">([\s\S]*?)<\/div>\s*<\/div>/gi;
  let m;
  while ((m = badgeRe.exec(visible)) !== null) {
    const inner = m[1] + '</div>';
    const head = /<div class="cb-head">([\s\S]*?)<\/div>/i.exec(inner);
    const text = /<div class="cb-text">([\s\S]*?)<\/div>/i.exec(inner);
    if (!head || !text) continue;
    entries.push({ q: stripTags(head[1]), a: stripTags(text[1]) });
  }
  if (!entries.length) throw RenderError('Не удалось прочитать видимый блок FAQ для микроразметки');

  const items = entries.map(function (e) {
    return '        {\n' +
      '          "@type": "Question",\n' +
      '          "name": ' + jsonForScript(e.q) + ',\n' +
      '          "acceptedAnswer": {\n' +
      '            "@type": "Answer",\n' +
      '            "text": ' + jsonForScript(e.a) + '\n' +
      '          }\n' +
      '        }';
  });

  return '\n    <script type="application/ld+json">\n' +
    '    {\n' +
    '      "@context": "https://schema.org",\n' +
    '      "@type": "FAQPage",\n' +
    '      "mainEntity": [\n' +
    items.join(',\n') + '\n' +
    '      ]\n' +
    '    }\n' +
    '    </script>\n    ';
}

// --- публичное API ---

function renderPricesHtml(html, prices) {
  const index = buildIndex(prices);
  let out = html;
  out = applyPriceElements(out, prices, index);
  out = applyTextTemplates(out, prices, index);
  out = applyNote(out, prices);
  out = replaceBlock(out, 'table', buildTableBlock(prices));
  out = replaceBlock(out, 'offers', buildOffersBlock(prices));
  // FAQ-микроразметка строится после подстановки цен в видимый текст
  out = replaceBlock(out, 'faq', buildFaqBlock(out));
  return out;
}

function targets() {
  const raw = process.env.RENDER_TARGETS;
  if (raw && raw.trim()) {
    return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  return [path.join(__dirname, '..', 'web')];
}

function writeAtomic(filepath, content) {
  const tmp = filepath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filepath);
}

// dryRun: только проверить, что все ссылки со страниц разрешаются, ничего не писать.
function renderAll(prices, options) {
  const opts = options || {};
  const changed = [];
  targets().forEach(function (root) {
    if (!fs.existsSync(root)) return;
    PAGES.forEach(function (page) {
      const filepath = path.join(root, page);
      if (!fs.existsSync(filepath)) return;
      const html = fs.readFileSync(filepath, 'utf-8');
      const out = renderPricesHtml(html, prices);
      if (out === html) return;
      changed.push(filepath);
      if (!opts.dryRun) writeAtomic(filepath, out);
    });
  });
  return changed;
}

module.exports = { renderPricesHtml, renderAll, RenderError };

// --- CLI ---
// node render-prices.js          — отрендерить страницы из прайса
// node render-prices.js --check  — проверить, что рендер не даёт расхождений (для ревью/QA)
if (require.main === module) {
  const check = process.argv.indexOf('--check') !== -1;
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const custom = path.join(dataDir, 'prices.json');
  const source = fs.existsSync(custom) ? custom : path.join(__dirname, 'prices.default.json');
  const prices = JSON.parse(fs.readFileSync(source, 'utf-8'));
  try {
    const changed = renderAll(prices, { dryRun: check });
    if (check) {
      if (changed.length) {
        process.stderr.write('Расхождение с прайсом (' + source + '):\n  ' + changed.join('\n  ') + '\n');
        process.exit(1);
      }
      process.stdout.write('OK: страницы соответствуют прайсу (' + source + ')\n');
    } else {
      process.stdout.write(changed.length ? 'Обновлено:\n  ' + changed.join('\n  ') + '\n' : 'Изменений нет\n');
    }
  } catch (e) {
    process.stderr.write('Ошибка рендера: ' + e.message + '\n');
    process.exit(1);
  }
}
