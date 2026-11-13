/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('node:child_process');
const { isIPv4 } = require('node:net');
const { join } = require('node:path');
const { parseArgs } = require('node:util');

let options;
try {
  ({ values: options } = parseArgs({
    options: {
      hostname: { type: 'string', default: '127.0.0.1' },
      port: { type: 'string', default: '4000' },
      'api-url': { type: 'string' },
    },
  }));
} catch (error) {
  console.error(error.message);
  console.error('Uso: npm run dev:demo -- [--hostname IP] [--port PUERTO] [--api-url URL]');
  process.exit(1);
}

const { hostname, port, 'api-url': apiUrl } = options;
const shared = hostname !== '127.0.0.1';
const webDir = join(__dirname, '..');

if (!isIPv4(hostname) || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error('Indica una IPv4 local, 0.0.0.0 para varias interfaces y un puerto válido.');
  process.exit(1);
}

if (shared && !apiUrl) {
  console.error('Indica --api-url con la dirección de la API de pruebas visible para tus compañeros.');
  process.exit(1);
}

try {
  process.loadEnvFile(join(webDir, '.env.demo.local'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.error('Crea apps/web/.env.demo.local con las cuentas de prueba.');
  process.exit(1);
}

const env = { ...process.env };
if (apiUrl) env.NEXT_PUBLIC_API_URL = apiUrl;
env.NEXT_DIST_DIR = `.next-demo-${port}`;

const server = spawn(process.execPath, [
  require.resolve('next/dist/bin/next'),
  'dev',
  '--hostname', hostname,
  '--port', port,
], { cwd: webDir, env, stdio: 'inherit' });

server.on('error', (error) => {
  console.error('No fue posible iniciar Next.js:', error.message);
  process.exitCode = 1;
});

server.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code;
});
