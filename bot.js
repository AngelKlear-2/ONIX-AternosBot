process.on('uncaughtException', (err) => {
  console.error('Fatal uncaughtException:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

require('./src');
