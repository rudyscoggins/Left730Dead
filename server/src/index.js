/**
 * Entrypoint for Left 730 Dead Server
 */

import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT || '7300', 10);
const instance = createServer(PORT);

instance.start();

// Handle graceful shutdown
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  instance.engine.stop();
  instance.server.close(() => {
    console.log('Server closed successfully.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
