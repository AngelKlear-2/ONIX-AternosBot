const fs = require('node:fs');
const path = require('node:path');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getEnvPath(rootDirectory = process.cwd()) {
  return path.resolve(rootDirectory, '.env');
}

function updateEnvValue(envPath, key, value) {
  const normalizedValue = String(value).replace(/\r?\n/g, '').trim();
  const nextLine = `${key}=${normalizedValue}`;
  let content = '';

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  const matcher = new RegExp(`^${escapeRegExp(key)}=.*$`, 'm');

  if (matcher.test(content)) {
    content = content.replace(matcher, nextLine);
  } else {
    const normalizedContent = content.replace(/\s*$/, '');
    content = normalizedContent ? `${normalizedContent}\n${nextLine}\n` : `${nextLine}\n`;
  }

  const tmpPath = `${envPath}.tmp`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, envPath);
  process.env[key] = normalizedValue;
  return normalizedValue;
}

module.exports = {
  getEnvPath,
  updateEnvValue
};
