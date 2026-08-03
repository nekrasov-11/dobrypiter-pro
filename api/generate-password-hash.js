#!/usr/bin/env node
// Генерация хэша пароля админки для /etc/dobrypiter/api.env.
// Использование:
//   node generate-password-hash.js <пароль>
// или без аргумента — пароль читается со stdin:
//   echo -n 'пароль' | node generate-password-hash.js

const crypto = require('crypto');

function printHash(password) {
  if (!password) {
    process.stderr.write('Пароль пустой. Использование: node generate-password-hash.js <пароль>\n');
    process.exit(1);
  }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  process.stdout.write('ADMIN_PASSWORD_HASH=scrypt:' + salt.toString('hex') + ':' + hash.toString('hex') + '\n');
}

if (process.argv[2]) {
  printHash(process.argv[2]);
} else {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => printHash(input.replace(/\r?\n$/, '')));
}
