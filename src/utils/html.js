function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function maskSecret(value) {
  const text = String(value || '');

  if (!text) {
    return 'не задан';
  }

  if (text.length <= 2) {
    return '*'.repeat(text.length);
  }

  return `${text.slice(0, 1)}${'*'.repeat(Math.max(4, text.length - 2))}${text.slice(-1)}`;
}

module.exports = {
  escapeHtml,
  maskSecret
};
