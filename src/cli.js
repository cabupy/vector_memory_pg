#!/usr/bin/env node
// cli.js — vector-memory CLI
// Comandos: init-project | doctor | ingest | search | quickstart | mcp-config | migrate | up | down

import { readFile, writeFile, stat, readdir, access } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync, spawn } from 'child_process';
import { createInterface } from 'readline';
import { homedir } from 'os';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Orden de carga (el primero en setear una var gana):
// 1. Shell / process.env ya seteado
// 2. ~/.vector-memory.env — config global, independiente del proyecto actual
// 3. .env del CWD         — puede ser de otro proyecto
// 4. .env del paquete     — fallback de instalación
dotenv.config({ path: join(homedir(), '.vector-memory.env') });
dotenv.config();
dotenv.config({ path: resolve(__dirname, '..', '.env') });

// ─── ANSI (sin dependencias extra) ───────────────────────────────────────────
const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

// ─── Config ───────────────────────────────────────────────────────────────────
const CONFIG_FILE = '.vector-memory.json';

function findConfigFile(startDir = process.cwd()) {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function loadConfig() {
  const p = findConfigFile();
  if (!p) return null;
  const raw = await readFile(p, 'utf-8');
  return { config: JSON.parse(raw), path: p };
}

// ─── Git helpers ──────────────────────────────────────────────────────────────
function gitRemoteUrl() {
  try {
    return execSync('git remote get-url origin', { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString().trim();
  } catch { return null; }
}

function detectRepoName() {
  const url = gitRemoteUrl();
  if (!url) return null;
  const m = url.match(/\/([^/]+?)(?:\.git)?$/);
  return m ? m[1] : null;
}

function detectOrg() {
  const url = gitRemoteUrl();
  if (!url) return null;
  const m = url.match(/[:/]([^/]+)\/[^/]+(?:\.git)?$/);
  return m ? m[1] : null;
}

// ─── Arg parsing ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const raw = argv.slice(2);
  const command = raw[0];
  const flags = {};
  const positional = [];

  for (let i = 1; i < raw.length; i++) {
    if (raw[i].startsWith('--')) {
      const [k, v] = raw[i].slice(2).split('=');
      if (v !== undefined)                              flags[k] = v;
      else if (i + 1 < raw.length && !raw[i + 1].startsWith('--')) flags[k] = raw[++i];
      else                                              flags[k] = true;
    } else {
      positional.push(raw[i]);
    }
  }

  return { command, flags, positional };
}

// ─── COMMAND: init-project ────────────────────────────────────────────────────
async function cmdInitProject(flags) {
  console.log(c.bold('\nvector-memory init-project\n'));

  const rl  = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q, def) => new Promise(res => {
    if (flags.yes) { res(def ?? ''); return; }
    const hint = def != null && def !== '' ? c.dim(` [${def}]`) : '';
    rl.question(`  ${q}${hint}: `, ans => res(ans.trim() || def || ''));
  });

  const repoDetected = detectRepoName();
  const orgDetected  = detectOrg();

  // Auto-detectar archivos candidatos a ingestar
  const cwd = process.cwd();
  const candidatePaths = ['AGENTS.md', 'README.md', 'docs/'];
  const detectedPaths  = candidatePaths.filter(p => existsSync(join(cwd, p)));
  const defaultPaths   = detectedPaths.length > 0 ? detectedPaths.join(',') : 'README.md';

  const organization = flags.org         || await ask('Organizacion',                  orgDetected  || '');
  const project      = flags.project     || await ask('Proyecto',                      repoDetected || '');
  const repo_name    = flags.repo        || await ask('Repo name',                     repoDetected || '');
  const memory_type  = flags.type        || await ask('Memory type',                   'memory');
  const criticality  = flags.criticality || await ask('Criticality',                   'normal');
  const tagsRaw      = flags.tags        || await ask('Tags (separados por coma)',      '');
  const ingestRaw    = flags['ingest-paths'] || await ask('Paths a ingestar (coma)',   defaultPaths);

  rl.close();

  const config = {
    organization: organization || null,
    project:      project      || null,
    repo_name:    repo_name    || null,
    memory_type:  memory_type  || 'memory',
    criticality:  criticality  || 'normal',
    tags:         tagsRaw  ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)  : [],
    ingest_paths: ingestRaw ? ingestRaw.split(',').map(p => p.trim()).filter(Boolean) : [],
  };

  const configPath = join(process.cwd(), CONFIG_FILE);
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');

  console.log(c.green(`\n✓ ${configPath}\n`));
  if (detectedPaths.length > 0) {
    console.log(c.dim(`  Archivos detectados para ingestar: ${detectedPaths.join(', ')}\n`));
  }
  console.log(c.dim(JSON.stringify(config, null, 2)) + '\n');

  if (flags.ingest) {
    await cmdIngest({ positional: [], flags, preloadedConfig: config });
  }
}

// ─── COMMAND: doctor ──────────────────────────────────────────────────────────
async function cmdDoctor() {
  console.log(c.bold('\nvector-memory doctor\n'));

  const checks = [];

  // Node version
  const [major] = process.versions.node.split('.').map(Number);
  checks.push({ ok: major >= 22, label: `Node.js v${process.versions.node}`, hint: 'Requiere Node.js 22+' });

  // Env vars
  const dbUrl = process.env.VECTOR_MEMORY_DATABASE_URL || process.env.DATABASE_URL;
  checks.push({
    ok:    !!dbUrl,
    label: 'VECTOR_MEMORY_DATABASE_URL',
    hint:  process.env.DATABASE_URL
      ? 'Usando DATABASE_URL como fallback (recomendado: setear VECTOR_MEMORY_DATABASE_URL)'
      : 'Falta en ~/.vector-memory.env o en el entorno',
  });
  checks.push({ ok: !!process.env.OPENAI_API_KEY, label: 'OPENAI_API_KEY', hint: 'Falta en .env' });

  // Config file
  const cfgPath = findConfigFile();
  checks.push({
    ok:    !!cfgPath,
    label: CONFIG_FILE,
    info:  cfgPath || '',
    hint:  'Ejecuta: vector-memory init-project',
  });

  // DB + pgvector + tabla
  if (dbUrl) {
    try {
      const pg = await import('pg');
      const client = new pg.default.Client({ connectionString: dbUrl });
      await client.connect();

      checks.push({ ok: true, label: 'PostgreSQL conexion' });

      const ext = await client.query(`SELECT extname FROM pg_extension WHERE extname = 'vector'`);
      checks.push({
        ok:    ext.rows.length > 0,
        label: 'pgvector extension',
        hint:  'CREATE EXTENSION IF NOT EXISTS vector;',
      });

      const tbl = await client.query(`SELECT COUNT(*) AS n FROM memories`);
      checks.push({ ok: true, label: `tabla memories`, info: `${tbl.rows[0].n} registros` });

      await client.end();
    } catch (err) {
      checks.push({ ok: false, label: 'PostgreSQL', hint: err.message });
    }
  }

  let allOk = true;
  for (const ch of checks) {
    const icon  = ch.ok ? c.green('✓') : c.red('✗');
    const label = ch.ok ? ch.label : c.red(ch.label);
    const extra = !ch.ok && ch.hint
      ? c.dim(`  → ${ch.hint}`)
      : (ch.ok && ch.info ? c.dim(`  ${ch.info}`) : '');
    console.log(`  ${icon}  ${label}${extra}`);
    if (!ch.ok) allOk = false;
  }

  console.log('');
  if (allOk) {
    console.log(c.green('Todo OK.\n'));
  } else {
    console.log(c.yellow('Hay problemas que resolver.\n'));
    process.exit(1);
  }
}

// ─── COMMAND: ingest ──────────────────────────────────────────────────────────
async function cmdIngest({ positional = [], flags = {}, preloadedConfig = null } = {}) {
  const loaded = preloadedConfig
    ? { config: preloadedConfig }
    : await loadConfig();

  if (!loaded) {
    console.error(c.red('No se encontró .vector-memory.json — ejecuta: vector-memory init-project'));
    process.exit(1);
  }

  const { config }   = loaded;
  const dryRun       = !!flags['dry-run'];
  const secretMode   = flags['secret-mode'] || process.env.INGEST_SECRET_MODE || 'block';

  // Propagar config al entorno para que ingest-one.js la use
  if (config.organization) process.env.MEMORY_ORGANIZATION = config.organization;
  if (config.project)      process.env.MEMORY_PROJECT      = config.project;
  if (config.repo_name)    process.env.MEMORY_REPO_NAME    = config.repo_name;
  if (config.memory_type)  process.env.MEMORY_TYPE         = config.memory_type;
  if (config.criticality)  process.env.MEMORY_CRITICALITY  = config.criticality;
  if (config.tags?.length) process.env.MEMORY_TAGS         = config.tags.join(',');
  process.env.INGEST_SECRET_MODE = secretMode;

  // Determinar paths
  const rawPaths = positional.length > 0 ? positional : (config.ingest_paths || []);
  if (rawPaths.length === 0) {
    console.error(c.red('No hay paths — especifica uno o configura ingest_paths en .vector-memory.json'));
    process.exit(1);
  }

  // Expandir directorios
  const files = [];
  for (const p of rawPaths) {
    const abs = resolve(process.cwd(), p);
    try {
      const s = await stat(abs);
      if (s.isDirectory()) {
        const entries = await readdir(abs, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isDirectory() && /\.(md|jsonl)$/.test(e.name)) {
            files.push(join(abs, e.name));
          }
        }
      } else {
        files.push(abs);
      }
    } catch {
      console.warn(`  ${c.yellow('–')}  ${p}  ${c.dim('(no encontrado)')}`);
    }
  }

  if (files.length === 0) {
    console.log(c.yellow('No hay archivos para ingestar.\n'));
    return;
  }

  const dryLabel = dryRun ? c.yellow(' [dry-run]') : '';
  console.log(c.bold(`\nvector-memory ingest${dryLabel}\n`));
  console.log(c.dim(`  org=${config.organization || '-'}  project=${config.project || '-'}  repo=${config.repo_name || '-'}\n`));

  let nOk = 0, nSkip = 0, nErr = 0;

  for (const filePath of files) {
    const args = [filePath, config.memory_type || 'memory'];
    if (dryRun) args.push('--dry-run');

    const output = await spawnIngestOne(args);
    const rel    = filePath.startsWith(process.cwd())
      ? filePath.slice(process.cwd().length + 1)
      : filePath;

    if (dryRun && output.startsWith('{')) {
      try {
        const info = JSON.parse(output);
        const secrets = info.secrets_found > 0
          ? c.yellow(`${info.secrets_found} secreto(s)`)
          : c.dim('0 secretos');
        console.log(`  ${c.cyan('?')}  ${rel}  ${c.dim(info.chunks + ' chunks')}  ${secrets}`);
      } catch {
        console.log(`  ${c.cyan('?')}  ${rel}`);
      }
      nOk++;
    } else if (output.startsWith('OK:')) {
      console.log(`  ${c.green('✓')}  ${rel}  ${c.dim(output.slice(3))}`);
      nOk++;
    } else if (output.startsWith('SKIP')) {
      console.log(`  ${c.dim('–')}  ${rel}  ${c.dim('sin cambios')}`);
      nSkip++;
    } else {
      const msg = output.replace(/^ERROR:/, '').slice(0, 120);
      console.log(`  ${c.red('✗')}  ${rel}  ${c.red(msg)}`);
      nErr++;
    }
  }

  const parts = [
    c.green(`${nOk} ${dryRun ? 'simulados' : 'ingestados'}`),
    c.dim(`${nSkip} sin cambios`),
    nErr > 0 ? c.red(`${nErr} errores`) : null,
  ].filter(Boolean);
  console.log(`\n  ${parts.join('  ')}\n`);
}

function spawnIngestOne(args) {
  return new Promise(res => {
    const child = spawn(
      process.execPath,
      [join(__dirname, 'ingest-one.js'), ...args],
      { env: process.env, stdio: ['inherit', 'pipe', 'pipe'] }
    );
    let out = '', err = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('close', () => res(out.trim() || err.trim() || 'OK'));
  });
}

// ─── COMMAND: search ──────────────────────────────────────────────────────────
async function cmdSearch({ positional, flags }) {
  const query = positional.join(' ').trim();
  if (!query) {
    console.error(c.red('Uso: vector-memory search <query> [--limit N] [--repo NAME] [--type TYPE] [--status STATUS]'));
    process.exit(1);
  }

  const cfgResult = await loadConfig();

  // Importar módulos de DB/query dinámicamente (evita side-effects en comandos que no los necesitan)
  const { searchMemories } = await import(pathToFileURL(join(__dirname, 'query.js')).href);
  const dbMod = await import(pathToFileURL(join(__dirname, 'db.js')).href);
  const pool  = dbMod.default;

  // Nota: db.js usa camelCase internamente (repoName, memoryType)
  // Los flags del CLI usan snake_case / abreviaciones → convertir aquí
  const opts = {
    limit:        flags.limit       ? parseInt(flags.limit, 10)   : 5,
    repoName:     flags.repo        || flags['repo-name']         || undefined,
    organization: flags.org         || flags.organization         || undefined,
    project:      flags.project     || undefined,
    memoryType:   flags.type        || undefined,
    status:       flags.status      || undefined,
    criticality:  flags.criticality || undefined,
  };

  // Limpiar undefined
  for (const k of Object.keys(opts)) { if (opts[k] === undefined) delete opts[k]; }

  console.log(c.bold('\nvector-memory search\n'));
  console.log(c.dim(`  "${query}"\n`));

  try {
    const results = await searchMemories(query, opts);

    if (results.length === 0) {
      console.log(c.dim('  Sin resultados.\n'));
      return;
    }

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const pid       = r.public_id ? c.cyan(r.public_id) + '  ' : '';
      const scoreStr  = r.score != null ? c.cyan(`${r.score}`) : '–';
      const typeStr   = c.dim(r.memory_type || r.source_type || '?');
      const repoStr   = r.repo_name ? c.dim(` [${r.repo_name}]`) : '';
      const statusStr = r.status !== 'active' ? c.yellow(` ${r.status}`) : '';
      const critStr   = r.criticality && r.criticality !== 'normal'
        ? c.dim(` ${r.criticality}`)
        : '';

      console.log(`  ${c.bold(`${i + 1}.`)}  ${pid}score:${scoreStr}  ${typeStr}${repoStr}${statusStr}${critStr}`);
      if (r.source_path) console.log(`      ${c.dim(r.source_path)}`);

      const preview = r.content.replace(/\n+/g, ' ').trimStart().slice(0, 200);
      console.log(`      ${preview}`);
      console.log('');
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

// ─── COMMAND: migrate ─────────────────────────────────────────────────────────
async function cmdMigrate() {
  console.log(c.bold('\nvector-memory migrate\n'));
  if (!process.env.VECTOR_MEMORY_DATABASE_URL && !process.env.DATABASE_URL) {
    console.error(c.red('  DATABASE_URL (o VECTOR_MEMORY_DATABASE_URL) no está configurado. Revisa tu .env.\n'));
    process.exit(1);
  }
  const ok = await spawnNode([join(__dirname, 'setup-db.js')]);
  if (ok) {
    console.log(c.green('  ✓ Schema aplicado.\n'));
  } else {
    console.error(c.red('  ✗ Error al aplicar schema.\n'));
    process.exit(1);
  }
}

// ─── COMMAND: up / down ───────────────────────────────────────────────────────
async function cmdDockerUp(flags) {
  const composeFile = join(__dirname, '..', 'docker-compose.yml');
  if (!existsSync(composeFile)) {
    console.error(c.red('No se encontró docker-compose.yml.\n'));
    process.exit(1);
  }
  const profile = flags.full ? '--profile full' : '';
  const detach  = flags.detach !== false ? '-d' : '';
  console.log(c.bold('\nvector-memory up\n'));
  console.log(c.dim(`  docker compose up ${detach} ${profile}\n`));
  execSync(`docker compose -f "${composeFile}" up ${detach} ${profile}`.trim(), { stdio: 'inherit' });
}

async function cmdDockerDown() {
  const composeFile = join(__dirname, '..', 'docker-compose.yml');
  console.log(c.bold('\nvector-memory down\n'));
  execSync(`docker compose -f "${composeFile}" down`, { stdio: 'inherit' });
}

// ─── COMMAND: mcp-config ──────────────────────────────────────────────────────
async function cmdMcpConfig(flags) {
  const target = flags.target || 'generic';

  // Resolver ruta del ejecutable
  let cmd = 'vector-memory';
  try {
    cmd = execSync('which vector-memory', { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } catch { /* usar el nombre global */ }

  const dbUrl  = process.env.VECTOR_MEMORY_DATABASE_URL || process.env.DATABASE_URL || 'postgres://vector:vector@localhost:5433/vector_memory';
  const apiKey = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY';

  const config = {
    mcpServers: {
      'vector-memory-pg': {
        command: cmd,
        args: ['mcp'],
        env: {
          VECTOR_MEMORY_DATABASE_URL: dbUrl,
          OPENAI_API_KEY:             apiKey,
        },
      },
    },
  };

  const json = JSON.stringify(config, null, 2);

  const hints = {
    'claude-code': '~/.claude/claude_desktop_config.json  (o usa: claude mcp add)',
    'opencode':    '.opencode/config.json  →  clave "mcp"',
    'cursor':      'Cursor Settings → MCP → Add server',
    'openclaw':    'Configuración del agente OpenClaw → MCP servers',
    'generic':     null,
  };

  console.log(c.bold('\nvector-memory mcp-config\n'));
  if (hints[target]) {
    console.log(c.dim(`  Target: ${target}`));
    console.log(c.dim(`  Archivo: ${hints[target]}\n`));
  }

  console.log(json + '\n');
}

// ─── COMMAND: quickstart ──────────────────────────────────────────────────────
async function cmdQuickstart() {
  console.log(c.bold('\nvector-memory quickstart\n'));
  console.log(c.dim('  Configuracion inicial paso a paso.\n'));

  const rl  = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q, def) => new Promise(res => {
    const hint = def ? c.dim(` [${def}]`) : '';
    rl.question(`  ${q}${hint}: `, ans => res(ans.trim() || def || ''));
  });

  // 1. Node version
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 22) {
    console.error(c.red(`  ✗ Node.js ${process.versions.node} — se requiere 22+\n`));
    rl.close(); process.exit(1);
  }
  console.log(c.green(`  ✓ Node.js ${process.versions.node}`));

  // 2. .env
  const envPath = resolve(process.cwd(), '.env');
  const envExamplePath = resolve(__dirname, '..', '.env.example');
  let envExists = existsSync(envPath);

  if (!envExists) {
    console.log(c.yellow('\n  No se encontró .env en el directorio actual.'));
    const create = await ask('¿Crear .env ahora?', 'si');
    if (create.toLowerCase().startsWith('s')) {
      let template = '# vector-memory-pg\n';
      try { template = await readFile(envExamplePath, 'utf-8'); } catch { /* sin template */ }
      const dbUrl  = await ask('VECTOR_MEMORY_DATABASE_URL', 'postgres://vector:vector@localhost:5433/vector_memory');
      const apiKey = await ask('OPENAI_API_KEY', '');
      const content = template
        .replace(/^VECTOR_MEMORY_DATABASE_URL=.*/m, `VECTOR_MEMORY_DATABASE_URL=${dbUrl}`)
        .replace(/^DATABASE_URL=.*/m,               `DATABASE_URL=${dbUrl}`)
        .replace(/^OPENAI_API_KEY=.*/m,             `OPENAI_API_KEY=${apiKey}`);
      await writeFile(envPath, content);
      dotenv.config({ path: envPath });
      console.log(c.green('  ✓ .env creado'));
      envExists = true;
    }
  } else {
    dotenv.config({ path: envPath });
    console.log(c.green('  ✓ .env encontrado'));
  }

  // 3. Vars requeridas
  if (!process.env.VECTOR_MEMORY_DATABASE_URL && !process.env.DATABASE_URL) {
    console.error(c.red('  ✗ VECTOR_MEMORY_DATABASE_URL (o DATABASE_URL) no configurado\n'));
    rl.close(); process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn(c.yellow('  ! OPENAI_API_KEY no configurado — la ingesta no funcionará'));
  }

  // 4. Migraciones
  console.log(c.dim('\n  Aplicando schema (migrations)...'));
  const migOk = await spawnNode([join(__dirname, 'setup-db.js')]);
  if (migOk) {
    console.log(c.green('  ✓ Schema listo'));
  } else {
    console.error(c.red('  ✗ Error al aplicar schema — verifica VECTOR_MEMORY_DATABASE_URL y que PostgreSQL esté corriendo'));
    rl.close(); process.exit(1);
  }

  // 5. init-project si hay git remote y no hay config
  const cfgExists = !!findConfigFile();
  if (!cfgExists && gitRemoteUrl()) {
    console.log(c.dim('\n  Repo git detectado. Creando configuracion del proyecto...'));
    await cmdInitProject({ yes: true });
  }

  rl.close();

  // 6. MCP config snippet
  console.log(c.bold('\n  Configuracion MCP:\n'));
  await cmdMcpConfig({});

  // 7. Doctor
  console.log(c.dim('─'.repeat(50)));
  await cmdDoctor();

  console.log(c.bold('  Proximos pasos:\n'));
  console.log(`  ${c.cyan('vector-memory ingest')}    — indexar archivos del proyecto`);
  console.log(`  ${c.cyan('vector-memory search')} "<query>"  — buscar en memoria`);
  console.log(`  ${c.cyan('vector-memory mcp-config --target opencode')}  — config para tu agente\n`);
}

// ─── Cmd: worker ──────────────────────────────────────────────────────────────
async function cmdWorker(flags) {
  const port  = flags['port']  || process.env.PORT  || '3010';
  const host  = flags['host']  || process.env.HOST  || '127.0.0.1';
  const open  = flags['open']  || false;

  const uiUrl = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/ui`;

  console.log(c.bold('\nvector-memory worker\n'));
  console.log(`  HTTP server: ${c.cyan(`http://${host}:${port}`)}`);
  console.log(`  UI local:    ${c.cyan(uiUrl)}`);
  console.log(`  Eventos:     POST /events/session-{start,post-tool-use,end}`);
  console.log(`\n  Ctrl+C para detener\n`);

  const serverPath = resolve(__dirname, 'server.js');
  const env = { ...process.env, PORT: String(port), HOST: host };

  // Abrir browser después de que el server arranque
  if (open) {
    setTimeout(() => {
      const cmd = process.platform === 'win32' ? 'start'
                : process.platform === 'darwin' ? 'open'
                : 'xdg-open';
      try { execSync(`${cmd} "${uiUrl}"`, { stdio: 'ignore' }); } catch { /* silencioso */ }
    }, 1200);
  }

  await new Promise((res) => {
    const child = spawn(process.execPath, [serverPath], { env, stdio: 'inherit' });
    child.on('close', (code) => res(code === 0));
  });
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function spawnNode(args) {
  return new Promise(res => {
    const child = spawn(process.execPath, args, { env: process.env, stdio: 'inherit' });
    child.on('close', code => res(code === 0));
  });
}

// ─── Help ─────────────────────────────────────────────────────────────────────
function printHelp(unknown) {
  console.log(c.bold('\nvector-memory\n'));
  console.log('  Comandos:\n');
  console.log('    quickstart            Configuracion guiada desde cero');
  console.log('    init-project          Crea .vector-memory.json con la config del repo');
  console.log('    doctor                Verifica configuracion, DB y dependencias');
  console.log('    migrate               Aplica el schema SQL en la DB');
  console.log('    ingest [path...]      Ingesta archivos usando la config del proyecto');
  console.log('    search <query>        Busca memorias por similitud semantica');
  console.log('    worker                Inicia HTTP server con endpoints de eventos de sesion');
  console.log('    mcp-config            Genera snippet de config MCP copiable');
  console.log('    up                    docker compose up -d (solo PostgreSQL)');
  console.log('    down                  docker compose down\n');
  console.log('  Flags:\n');
  console.log('    --dry-run             Simula la ingesta sin guardar nada');
  console.log('    --secret-mode MODE    block|redact para ingesta (default: block)');
  console.log('    --limit N             Numero de resultados para search (default: 5)');
  console.log('    --repo NAME           Filtrar por repo_name');
  console.log('    --type TYPE           Filtrar por memory_type');
  console.log('    --status STATUS       Filtrar por status');
  console.log('    --org ORG             Filtrar por organizacion');
  console.log('    --project PROJECT     Filtrar por proyecto');
  console.log('    --yes                 Aceptar defaults en init-project (modo no interactivo)');
  console.log('    --target TARGET       Target para mcp-config: claude-code|opencode|cursor|openclaw');
  console.log('    --full                Levantar todos los servicios Docker (api incluida)');
  console.log('    --port PORT           Puerto para worker (default: 3010)');
  console.log('    --host HOST           Host para worker (default: 127.0.0.1)');
  console.log('    --open                Abrir UI en el browser al iniciar el worker\n');

  if (unknown) {
    console.error(c.red(`Comando desconocido: ${unknown}\n`));
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { command, flags, positional } = parseArgs(process.argv);

  switch (command) {
    case 'quickstart':
      await cmdQuickstart();
      break;
    case 'init-project':
    case 'init':
      await cmdInitProject(flags);
      break;
    case 'doctor':
      await cmdDoctor();
      break;
    case 'migrate':
      await cmdMigrate();
      break;
    case 'ingest':
      await cmdIngest({ positional, flags });
      break;
    case 'search':
      await cmdSearch({ positional, flags });
      break;
    case 'mcp-config':
      await cmdMcpConfig(flags);
      break;
    case 'worker':
      await cmdWorker(flags);
      break;
    case 'up':
      await cmdDockerUp(flags);
      break;
    case 'down':
      await cmdDockerDown();
      break;
    default:
      printHelp(command);
      break;
  }
}

main().catch(err => {
  console.error(c.red(`\nError: ${err.message}\n`));
  process.exit(1);
});
