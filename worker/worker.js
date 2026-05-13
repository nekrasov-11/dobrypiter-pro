// Cloudflare Worker — приём заявок с формы и отправка в Telegram-чат.
// Токен бота и ID чата хранятся в Secrets (см. worker/README.md).

const ALLOWED_ORIGINS = [
  'https://dobrypiter.pro',
  'https://www.dobrypiter.pro',
  'https://review.dobrypiter.pro',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

function escapeMarkdown(text) {
  if (text == null) return '';
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function clean(value, max) {
  if (value == null) return '';
  const s = String(value).trim();
  return s.length > max ? s.slice(0, max) : s;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, origin);
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
    }

    let data;
    try {
      data = await request.json();
    } catch (err) {
      return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
    }

    // Honeypot — если поле "website" заполнено, это бот. Молча отвечаем ok.
    if (data && data.website) {
      return jsonResponse({ ok: true }, 200, origin);
    }

    const name = clean(data && data.name, 100);
    const phone = clean(data && data.phone, 30);
    const group = clean(data && data.group, 60);
    const comment = clean(data && data.comment, 1000);

    if (!name || name.length < 2 || !phone || !group) {
      return jsonResponse({ error: 'Missing required fields' }, 400, origin);
    }

    if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) {
      return jsonResponse({ error: 'Worker not configured' }, 500, origin);
    }

    const source = origin === 'https://review.dobrypiter.pro' ? 'review.dobrypiter.pro (тест)' : 'dobrypiter.pro';

    const message =
      '🥊 *Новая заявка на пробное занятие*\n\n' +
      '👤 *Имя:* ' + escapeMarkdown(name) + '\n' +
      '📞 *Телефон:* ' + escapeMarkdown(phone) + '\n' +
      '🎯 *Группа:* ' + escapeMarkdown(group) + '\n' +
      '💬 *Комментарий:* ' + escapeMarkdown(comment || 'нет') + '\n\n' +
      '🌐 _Источник: ' + escapeMarkdown(source) + '_';

    try {
      const tgResponse = await fetch(
        'https://api.telegram.org/bot' + env.TG_BOT_TOKEN + '/sendMessage',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TG_CHAT_ID,
            text: message,
            parse_mode: 'MarkdownV2',
          }),
        }
      );

      if (!tgResponse.ok) {
        const errText = await tgResponse.text();
        console.error('Telegram error:', tgResponse.status, errText);
        return jsonResponse({ error: 'Telegram API error' }, 502, origin);
      }

      return jsonResponse({ ok: true }, 200, origin);
    } catch (err) {
      console.error('Worker error:', err && err.message);
      return jsonResponse({ error: 'Server error' }, 500, origin);
    }
  },
};
