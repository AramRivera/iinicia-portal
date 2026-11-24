// IINICIA Portal · herramientas del proyecto · literate.mjs
/** Cada bloque del capítulo corresponde a un archivo. La extracción aplica las mismas reglas de rutas que la generación y escribe en un directorio nuevo. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = join(root, 'docs', 'literaria');
const types = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', mjs: 'javascript',
  cjs: 'javascript', css: 'css', sql: 'sql', json: 'json',
  yaml: 'yaml', yml: 'yaml', svg: 'xml',
};
const volumes = [
  ['api', 'API y pruebas', 'La petición pasa primero por validación y permisos. A continuación se ejecuta la lógica de negocio y se invoca la integración necesaria.', (name) => name.startsWith('apps/api/')],
  ['web', 'Portal y pruebas', 'Las páginas componen la interfaz. Las bibliotecas compartidas documentan el contrato con la API y las reglas para tratar datos y enlaces.', (name) => name.startsWith('apps/web/')],
  ['infraestructura', 'Datos, contratos e infraestructura', 'Las migraciones establecen permisos y datos en orden cronológico. Docker conecta los servicios y OpenAPI publica el contrato de la API. El generador permite volver a crear los archivos a partir de estos capítulos.', () => true],
];
const narrative = {
  'apps/api/src/common': 'Los guards y clientes compartidos resuelven la identidad, verifican el alcance del rol y conservan los permisos de la sesión al consultar Supabase.',
  'apps/api/src/modules': 'Los controladores definen las entradas HTTP. Sus servicios aplican reglas de negocio y delegan a los clientes externos.',
  'apps/api/src/modules/auth': 'El ingreso, la recuperación y el segundo factor construyen una sesión antes de acceder a operaciones protegidas.',
  'apps/api/src/modules/users': 'Los perfiles identifican a las personas. Las operaciones de administración requieren el permiso correspondiente y dejan constancia en la bitácora.',
  'apps/api/src/modules/admissions': 'Una persona aspirante solicita acceso a un programa. El dictamen revisa la autorización de quien decide y actualiza el estado académico.',
  'apps/api/src/modules/enrollments': 'La solicitud y la autorización de una matrícula tienen estados distintos. La API registra la sincronización con el campus después del resultado de Moodle.',
  'apps/api/src/modules/help-chat': 'El asistente busca texto de ayuda, valida las respuestas y obtiene sus enlaces a partir de las fuentes internas.',
  'apps/api/src/modules/moodle': 'El servicio traduce la identidad y el ámbito del portal a operaciones del campus. El cliente limita los destinos y envía las credenciales por el canal configurado.',
  'apps/api/src/modules/health': 'Los diagnósticos públicos conservan el estado de las integraciones con mensajes genéricos para los errores de la base de datos.',
  'apps/web/src/app': 'El enrutador de Next.js carga las vistas públicas y los paneles. La API decide los permisos de los recursos protegidos.',
  'apps/web/src/lib': 'Las bibliotecas centralizan solicitudes y reglas de navegación, incluyendo la validación del destino de Moodle.',
  'apps/web/src/contexts': 'Los contextos comparten sesión y preferencias de interfaz entre las páginas.',
  'apps/web/src/components': 'Los componentes construyen formularios, navegación y paneles a partir de las respuestas del portal.',
  'apps/web/test': 'Las pruebas unitarias llaman directamente a las funciones de la aplicación y ejercitan las decisiones de navegación con datos de prueba.',
  'supabase/migrations': 'Los archivos se aplican por fecha. Las políticas de PostgreSQL limitan la lectura por sesión y rol incluso cuando la consulta llega directamente a la API de datos.',
  'supabase/tests': 'Las pruebas verifican privilegios y acceso por rol en una base de ensayo.',
  'docker': 'La configuración local conecta los servicios con una red interna y publica sus puertos hacia la máquina de desarrollo.',
};

// JSON no admite comentarios. La explicación se publica junto al bloque que se puede reconstruir.
const jsonContext = {
  'apps/api/.oxlintrc.json': 'Define las reglas del análisis estático de NestJS y TypeScript.',
  'apps/api/nest-cli.json': 'Indica a la CLI dónde comienza la API y cuándo limpiar la salida de compilación.',
  'apps/api/package.json': 'Declara el entorno de módulos, las dependencias y los comandos de compilación, pruebas y despliegue de la API.',
  'apps/api/tsconfig.build.json': 'Parte de la configuración general y limita la compilación de producción al código de src.',
  'apps/api/tsconfig.json': 'Configura el compilador TypeScript de la API y la emisión del proyecto.',
  'apps/web/package.json': 'Agrupa los comandos del portal y las dependencias usadas por Next.js y las pruebas.',
  'apps/web/tsconfig.json': 'Define cómo TypeScript comprueba el portal y resuelve sus rutas de importación.',
  'docs/openapi.json': 'Publica el contrato HTTP en un formato que pueden leer generadores de clientes y documentación.',
};

/** Acota los bloques a las rutas y formatos del código propio que la herramienta puede reconstruir. */
function isSource(name) {
  if (name.includes('..') || !/^[\w./@-]+$/.test(name)) return false;
  if (['docs/openapi.yaml', 'docs/openapi.json'].includes(name)) return true;
  if (!/^(apps\/(api|web)|docker|database|supabase|scripts)\//.test(name)) return false;
  return !name.endsWith('/package-lock.json') &&
    (name.endsWith('/Dockerfile') || Object.hasOwn(types, name.split('.').at(-1)));
}

/** Obtiene los archivos versionados y los nuevos no ignorados para identificar el conjunto de entrada. */
function sourceFiles() {
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root, encoding: 'utf8',
  });
  return [...new Set(paths.split('\0').filter(isSource))].sort();
}

/** Lee el archivo como texto y normaliza los finales de línea para comparar los capítulos entre plataformas. */
function readSource(name) {
  return readFileSync(join(root, name), 'utf8').replace(/\r\n/g, '\n');
}

/** Elige la explicación más específica disponible para ubicar el archivo en el capítulo correcto. */
function chapter(name) {
  const group = Object.keys(narrative).filter((prefix) => name.startsWith(prefix + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return group ?? dirname(name);
}

/** Agrupa los archivos por volumen y agrega un bloque cercado por cada fuente para mantener el contexto y la posibilidad de extraerla. */
function writeVolumes(files) {
  mkdirSync(docs, { recursive: true });
  const remaining = new Set(files);
  for (const [id, title, intro, belongs] of volumes) {
    const groups = new Map();
    for (const name of remaining) {
      if (!belongs(name)) continue;
      const section = chapter(name);
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section).push(name);
      remaining.delete(name);
    }
    const output = [`# ${title}\n\n${intro}\n`];
    for (const [group, names] of groups) {
      output.push(`\n## ${group}\n\n${narrative[group] ?? 'Archivos de este componente y su configuración.'}\n`);
      for (const name of names) {
        const content = readSource(name);
        const fence = '`'.repeat(Math.max(3, ...Array.from(content.matchAll(/`+/g), (run) => run[0].length + 1)));
        const language = types[name.split('.').at(-1)] ?? 'dockerfile';
        const explanation = jsonContext[name] ? `${jsonContext[name]}\n\n` : '';
        output.push(`\n### ${name}\n\n${explanation}<!-- archivo: ${name} -->\n${fence}${language}\n${content}\n${fence}\n`);
      }
    }
    writeFileSync(join(docs, id + '.md'), output.join(''), 'utf8');
  }
}

/** Valida cada marcador, el cierre y la unicidad de los bloques antes de comparar o reconstruir los archivos. */
function readVolumes() {
  const chunks = new Map();
  for (const [id] of volumes) {
    const markdown = readFileSync(join(docs, id + '.md'), 'utf8').replace(/\r\n/g, '\n');
    const lines = markdown.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].startsWith('<!-- archivo: ')) continue;
      const marker = lines[i].match(/^<!-- archivo: (.+) -->$/);
      const fence = lines[i + 1]?.match(/^(`{3,})[a-z]+$/)?.[1];
      const name = marker?.[1];
      if (!name || !isSource(name) || !fence || chunks.has(name)) {
        throw new Error(`Bloque literario inválido en ${id}.md, línea ${i + 1}`);
      }
      const end = lines.indexOf(fence, i + 2);
      if (end === -1) throw new Error(`Falta cerrar el bloque de ${name}`);
      chunks.set(name, lines.slice(i + 2, end).join('\n'));
      i = end;
    }
  }
  return chunks;
}

const [command, destination] = process.argv.slice(2);
if (command === 'sync') {
  writeVolumes(sourceFiles());
} else if (command === 'verify') {
  const files = sourceFiles();
  const chunks = readVolumes();
  const changed = files.filter((name) => chunks.get(name) !== readSource(name));
  const extra = [...chunks.keys()].filter((name) => !files.includes(name));
  if (changed.length || extra.length) throw new Error(`Bloques desactualizados: ${[...changed, ...extra].join(', ')}`);
  console.log(`${chunks.size} bloques coinciden con el código fuente.`);
} else if (command === 'extract' && destination) {
  const target = resolve(destination);
  const chunks = readVolumes();
  mkdirSync(target);
  for (const [name, content] of chunks) {
    const file = join(target, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, { encoding: 'utf8', flag: 'wx' });
  }
  console.log(`${chunks.size} archivos reconstruidos en ${target}.`);
} else {
  throw new Error('Uso: node scripts/literate.mjs sync | verify | extract <directorio-nuevo>');
}
