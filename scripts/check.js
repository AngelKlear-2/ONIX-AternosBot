const { spawnSync } = require('node:child_process');
const path = require('node:path');

const files = [
  'bot.js',
  'src/config.js',
  'src/index.js',
  'src/logger.js',
  'src/minecraft-controller.js',
  'src/persistence.js',
  'src/telegram/menus.js',
  'src/utils/html.js',
  'src/ai/pathfinder-setup.js',
  'src/ai/threat-policy.js',
  'src/ai/stuck-recovery.js',
  'src/ai/combat.js',
  'scripts/check.js',
  'scripts/fix-telegram-polling.js',
  'scripts/get-chat-id.js',
  'scripts/test-telegram.js'
];

let hasErrors = false;

for (const relativeFile of files) {
  const filePath = path.resolve(__dirname, '..', relativeFile);
  const result = spawnSync(process.execPath, ['--check', filePath], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log(`Checked ${files.length} files.`);
