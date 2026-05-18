function createLogger(maxLines = 80) {
  const buffer = [];

  function add(message) {
    const text = String(message);
    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    buffer.push(`[${time}] ${text}`);

    if (buffer.length > maxLines) {
      buffer.shift();
    }

    console.log(text);
  }

  function recent(limit = 12) {
    return buffer.slice(-limit);
  }

  return {
    add,
    recent
  };
}

module.exports = {
  createLogger
};
