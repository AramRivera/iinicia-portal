/** Arranca la demo local o compartida con su configuración de red y un directorio de compilación propio. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('node:child_process');
const { isIPv4 } = require('node:net');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseArgs, parseEnv } = require('node:util');

let options;
try {
  ({ values: options } = parseArgs({
    options: {
      hostname: { type: 'string', default: '127.0.0.1' },
      port: { type: 'string', default: '4000' },
      'api-url': { type: 'string' },
      lab: { type: 'boolean', default: false },
    },
  }));
} catch (error) {
  console.error(error.message);
  console.error('Uso: npm run dev:demo -- [--lab] [--hostname IP] [--port PUERTO] [--api-url URL]');
  process.exit(1);
}

const { hostname, port, 'api-url': apiUrl, lab } = options;
const shared = hostname !== '127.0.0.1';
const webDir = join(__dirname, '..');

if (!isIPv4(hostname) || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error('Indica una IPv4 local, 0.0.0.0 para varias interfaces y un puerto válido.');
  process.exit(1);
}

const envFile = lab ? '.env.demo.lab.local' : '.env.demo.local';
let demoEnv;
try {
  demoEnv = parseEnv(readFileSync(join(webDir, envFile), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.error(`Crea apps/web/${envFile} con las cuentas de prueba.`);
  process.exit(1);
}

let localEnv = {};
try {
  localEnv = parseEnv(readFileSync(join(webDir, '.env.local'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
// Las variables de la demo prevalecen sobre el entorno local. El argumento --api-url puede reemplazar la URL resultante.
const env = { ...process.env, ...localEnv, ...demoEnv };
if (apiUrl) env.NEXT_PUBLIC_API_URL = apiUrl;
if ((shared || lab) && !env.NEXT_PUBLIC_API_URL) {
  console.error('Indica la URL de la API de pruebas con --api-url o en el archivo de demo.');
  process.exit(1);
}
if (shared && !apiUrl && !demoEnv.NEXT_PUBLIC_API_URL) {
  console.error('Para ZeroTier indica --api-url con la dirección accesible de la API.');
  process.exit(1);
}
// Aísla la compilación de la demo por perfil y puerto para que no comparta su caché con el arranque habitual.
env.NEXT_DIST_DIR = `.next-demo-${lab ? 'lab' : 'remote'}-${port}`;
console.log(`Demo ${lab ? 'laboratorio' : 'Supabase configurado en la API'} · API: ${env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}`);

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
