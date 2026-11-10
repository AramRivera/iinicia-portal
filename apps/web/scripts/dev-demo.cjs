const { spawn } = require('node:child_process');
const { join } = require('node:path');

try {
  process.loadEnvFile(join(__dirname, '..', '.env.demo.local'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.error('Crea apps/web/.env.demo.local con las cuentas de prueba.');
  process.exit(1);
}

const server = spawn(process.execPath, [
  require.resolve('next/dist/bin/next'),
  'dev',
  '--hostname', '127.0.0.1',
  '--port', '4000',
], { stdio: 'inherit' });

server.on('error', (error) => {
  console.error('No fue posible iniciar Next.js:', error.message);
  process.exitCode = 1;
});

server.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code;
});
