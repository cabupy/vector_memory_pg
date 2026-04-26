#!/usr/bin/env node
// cli.js — vector-memory CLI
// Comandos: init-project | doctor | ingest | search | quickstart | mcp-config | migrate | up | down

import { readFile, writeFile, stat, readdir, access, mkdir } from 'fs/promises';
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
  checks.push({
    ok:   !!process.env.OPENAI_API_KEY,
    label: 'OPENAI_API_KEY',
    hint:  'Falta en ~/.vector-memory.env — requerida para ingesta, auto_classify y reflect_memories',
  });

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

  // 2. Config global ~/.vector-memory.env (preferida sobre .env local)
  const globalEnvPath = join(homedir(), '.vector-memory.env');
  const globalExists  = existsSync(globalEnvPath);

  if (globalExists) {
    dotenv.config({ path: globalEnvPath });
    console.log(c.green(`  ✓ ${globalEnvPath} encontrado`));
  } else {
    console.log(c.yellow(`\n  No se encontró ${globalEnvPath}`));
    console.log(c.dim('  Este archivo aplica desde cualquier directorio y evita colisiones con otros proyectos.'));
    const create = await ask('¿Crear ~/.vector-memory.env ahora?', 'si');
    if (create.toLowerCase().startsWith('s')) {
      const dbUrl  = await ask('VECTOR_MEMORY_DATABASE_URL', 'postgres://vector:vector@localhost:5433/vector_memory');
      const apiKey = await ask('OPENAI_API_KEY', '');
      const envContent = [
        '# vector-memory — config global de usuario',
        '# Se carga automáticamente desde cualquier directorio.',
        '',
        `VECTOR_MEMORY_DATABASE_URL=${dbUrl}`,
        `OPENAI_API_KEY=${apiKey}`,
        '',
      ].join('\n');
      await writeFile(globalEnvPath, envContent);
      dotenv.config({ path: globalEnvPath });
      console.log(c.green(`  ✓ ${globalEnvPath} creado`));
    } else {
      // Fallback: .env local
      const localEnvPath = resolve(process.cwd(), '.env');
      if (existsSync(localEnvPath)) {
        dotenv.config({ path: localEnvPath });
        console.log(c.green('  ✓ .env local encontrado'));
      }
    }
  }

  // 3. Vars requeridas
  if (!process.env.VECTOR_MEMORY_DATABASE_URL && !process.env.DATABASE_URL) {
    console.error(c.red('  ✗ VECTOR_MEMORY_DATABASE_URL (o DATABASE_URL) no configurado\n'));
    rl.close(); process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn(c.yellow('  ! OPENAI_API_KEY no configurado — la ingesta y classify no funcionarán'));
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
  console.log(`  ${c.cyan('vector-memory ingest')}                    — indexar archivos del proyecto`);
  console.log(`  ${c.cyan('vector-memory search')} "<query>"           — buscar en memoria`);
  console.log(`  ${c.cyan('vector-memory worker --open')}              — levantar server y abrir UI`);
  console.log(`  ${c.cyan('vector-memory mcp-config --target opencode')} — config MCP para tu agente`);
  console.log(c.dim('\n  Funciones avanzadas (via MCP o HTTP API):'));
  console.log(c.dim('  • save_memory con auto_classify:true   — clasificacion automatica por IA'));
  console.log(c.dim('  • reflect_memories                     — detectar contradicciones y consolidar\n'));
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

// ─── SLASH COMMAND CONTENT ────────────────────────────────────────────────────
const SLASH_COMMANDS = {
  'vm-context': {
    title: 'Establecer contexto desde vector-memory',
    content: `Establece contexto técnico desde vector-memory antes de comenzar la tarea.

Pasos:
1. Usa la herramienta MCP \`recent_memories\` (limit: 5) para ver trabajo reciente
2. Usa \`search_memories_compact\` con el tema: $ARGUMENTS
3. Resume los hallazgos: decisiones activas, bugs conocidos, restricciones críticas
4. Ignora memorias con status=deprecated salvo pedido explícito
5. Cita las memorias relevantes por su public_id (ej: VM-000042)

Si $ARGUMENTS está vacío, usa el contexto del archivo o tarea actual.`,
  },
  'vm-search': {
    title: 'Buscar en vector-memory',
    content: `Busca en vector-memory memorias técnicas relevantes para la tarea actual.

1. Usa \`search_memories_compact\` con query: $ARGUMENTS
2. Expande con \`get_memories\` los IDs más importantes si necesitas contenido completo
3. Prioriza: activas > verificadas > criticidad alta
4. Ignora memorias deprecated salvo pedido explícito
5. Cita cada memoria usada por su public_id (ej: VM-000042)`,
  },
  'vm-save': {
    title: 'Guardar memoria técnica',
    content: `Guarda un aprendizaje técnico importante en vector-memory.

Usa la herramienta MCP \`save_memory\`:
- content: $ARGUMENTS (o pide descripción al usuario si está vacío)
- Incluye: qué, por qué, cómo aplica, cuándo NO aplica
- Usa \`auto_classify: true\` si no tienes claro el tipo o criticidad
- Confirma al usuario el public_id asignado (ej: VM-000042)

Tipos útiles: decision, bug, pattern, constraint, architecture, security`,
  },
  'vm-reflect': {
    title: 'Reflexionar sobre la memoria acumulada',
    content: `Ejecuta Reflect en vector-memory para analizar la calidad del conocimiento acumulado.

1. Usa \`reflect_memories\` (limit: 20; puedes agregar project/focus: $ARGUMENTS)
2. Resume hallazgos por tipo: contradicción, duplicado, gap
3. Para deprecaciones sugeridas: evalúa y usa \`deprecate_memory\` si aplica
4. Para memorias nuevas sugeridas: evalúa y usa \`save_memory\` si aportan valor
5. Reporta: X analizadas, Y acciones tomadas

Reflect solo sugiere. No modifica nada.`,
  },
  'vm-iterate': {
    title: 'Mejorar memoria en ciclos',
    content: `Mejora la calidad de la memoria técnica del proyecto en ciclos.

Modo: $ARGUMENTS (consolidar | duplicados | deprecated | gaps | vacío = análisis completo)

1. Usa \`reflect_memories\` para obtener análisis completo
2. Consolida duplicados actualizando con \`update_memory\`
3. Depreca memorias obsoletas con \`deprecate_memory\` + razón clara
4. Guarda memorias valiosas de las sugerencias con \`save_memory\`
5. Verifica memorias críticas vigentes con \`verify_memory\`
6. Cierra con \`save_session_summary\`

Resumen final: memorias activas antes/después, acciones tomadas.`,
  },
};

// ─── SKILL CONTENT (instrucciones por agente) ─────────────────────────────────
const SKILL_CONTENT = {
  'claude-code': `
## vector-memory — Instrucciones de uso

Tienes acceso a vector-memory-pg como memoria técnica persistente del proyecto.
Úsala en cada sesión de trabajo.

### Buscar antes de modificar
Antes de modificar código importante, usa \`search_memories_compact\` con el tema relevante.
Prioriza memorias \`active\` y verificadas. Ignora \`deprecated\` salvo pedido explícito.
Expande con \`get_memories\` cuando necesites el contenido completo.

### Cuándo guardar
Usa \`save_memory\` con \`auto_classify: true\` para:
- Decisiones de arquitectura no obvias
- Bugs con causa raíz importante
- Restricciones o convenciones del sistema
- Patrones que funcionaron (o fallaron)

### Cuándo usar Reflect
Usa \`reflect_memories\` cuando detectes contradicciones entre memorias
o antes de sesiones de refactoring. Reflect solo sugiere; aplica manualmente.

### Citar memorias
Siempre cita por public_id: "Según VM-000042, la restricción es..."

### Al finalizar sesión
Llama \`save_session_summary\` con: qué se hizo, decisiones tomadas, qué quedó pendiente.
`,
  'opencode': `
## vector-memory — Instrucciones de uso

Tienes acceso a vector-memory-pg como memoria técnica persistente.

- Buscar: usa \`search_memories_compact\` antes de modificar código importante
- Prioriza activas y verificadas; ignora deprecated salvo pedido explícito
- Guardar: usa \`save_memory\` con \`auto_classify: true\` para decisiones, bugs, restricciones
- Reflect: usa \`reflect_memories\` ante contradicciones (solo sugiere)
- Citar: siempre por public_id (ej: VM-000042)
- Al finalizar: llama \`save_session_summary\`
`,
  'codex': `
## vector-memory — Instrucciones de uso

Tienes acceso a vector-memory-pg como memoria técnica persistente.

- Busca antes de modificar código: \`search_memories_compact\`
- Prioriza memorias activas y verificadas; ignora deprecated
- Guarda aprendizajes: \`save_memory\` con \`auto_classify: true\`
- Ante contradicciones: \`reflect_memories\` (solo sugiere)
- Cita por public_id: "Según VM-000042..."
- Al finalizar: \`save_session_summary\`
`,
  'openclaw': `
## vector-memory — Instrucciones de uso

Tienes acceso a vector-memory-pg como memoria técnica persistente.

- Busca antes de modificar código: \`search_memories_compact\`
- Prioriza memorias activas y verificadas; ignora deprecated
- Guarda aprendizajes: \`save_memory\` con \`auto_classify: true\`
- Ante contradicciones: \`reflect_memories\` (solo sugiere)
- Cita por public_id: "Según VM-000042..."
- Al finalizar: \`save_session_summary\`
`,
};

const CURSOR_RULE_CONTENT = `---
description: >
  Reglas de uso de vector-memory-pg para agentes IA.
  Buscar antes de modificar, guardar aprendizajes,
  Reflect ante contradicciones, citar por public_id.
globs:
  - "**/*"
alwaysApply: true
---

# vector-memory-pg — Reglas de uso

Tienes acceso a vector-memory-pg como memoria técnica persistente del proyecto.

## Cuándo buscar en memoria

Busca con \`search_memories_compact\` antes de:
- Modificar arquitectura o patrones del proyecto
- Implementar features similares a trabajo previo
- Tomar decisiones de tecnología o dependencias
- Resolver bugs que podrían estar documentados

Expande con \`get_memories\` si necesitas el contenido completo.

## Prioridad de memorias

1. \`status: active\` con \`last_verified_at\` reciente — máxima confianza
2. \`criticality: critical\` o \`high\` — no ignorar nunca
3. \`status: deprecated\` — ignorar salvo pedido explícito del usuario

## Cuándo guardar en memoria

Usa \`save_memory\` con \`auto_classify: true\` cuando:
- Tomas una decisión de arquitectura no obvia
- Encuentras un bug con causa raíz importante
- Descubres una restricción o convención del sistema
- La sesión cierra con aprendizajes valiosos

## Cuándo usar Reflect

Usa \`reflect_memories\` cuando:
- Detectas contradicciones entre memorias
- El proyecto tiene muchas memorias sin revisar
- Antes de una sesión de refactoring importante

Reflect solo sugiere. No modifica nada.

## Cómo citar memorias

Siempre cita por \`public_id\`:
- "Según VM-000042, la columna es GENERATED ALWAYS AS..."
- "Ver VM-000007 para las restricciones de autenticación"

## Al finalizar cada sesión

Usa \`save_session_summary\` con: qué se hizo, decisiones tomadas, qué quedó pendiente.
`;

// ─── helpers de banco ─────────────────────────────────────────────────────────
function parseBankName(name) {
  const idx = name.indexOf('/');
  if (idx > 0) return [name.slice(0, idx), name.slice(idx + 1)];
  return [null, name];
}

async function showBankStats(client, name) {
  const [org, project] = parseBankName(name);
  const whereClause = org
    ? `organization = $1 AND project = $2`
    : `project = $1`;
  const params = org ? [org, project] : [project];

  const res = await client.query(`
    SELECT
      COUNT(*)                                                              AS total,
      SUM(CASE WHEN status = 'active'     THEN 1 ELSE 0 END)              AS active,
      SUM(CASE WHEN status = 'deprecated' THEN 1 ELSE 0 END)              AS deprecated,
      SUM(CASE WHEN criticality IN ('critical','high') THEN 1 ELSE 0 END) AS high_crit,
      array_agg(DISTINCT memory_type)
        FILTER (WHERE memory_type IS NOT NULL)                             AS types,
      MAX(created_at)                                                      AS latest
    FROM memories
    WHERE ${whereClause}
  `, params);

  const r = res.rows[0];
  console.log(c.bold(`\nvector-memory bank show — ${name}\n`));
  console.log(`  Total:      ${r.total}`);
  console.log(`  Activas:    ${r.active}`);
  console.log(`  Deprecated: ${r.deprecated}`);
  console.log(`  Críticas:   ${r.high_crit}`);
  console.log(`  Tipos:      ${(r.types || []).join(', ') || '—'}`);
  console.log(`  Última:     ${r.latest ? new Date(r.latest).toISOString().slice(0, 10) : '—'}`);
  console.log('');
}

// ─── COMMAND: skills install ──────────────────────────────────────────────────
async function cmdSkillsInstall(flags) {
  const target  = String(flags.target || 'all');
  const dir     = flags.dir ? resolve(flags.dir) : process.cwd();
  const yes     = !!flags.yes;
  const targets = target === 'all'
    ? ['claude-code', 'cursor', 'opencode', 'codex', 'openclaw']
    : target.split(',').map(t => t.trim());

  if (!flags._noHeader) console.log(c.bold('\nvector-memory skills install\n'));

  const rl  = createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(res => {
    if (yes) { res('s'); return; }
    rl.question(`  ${q} [S/n]: `, ans => res(ans.trim().toLowerCase() || 's'));
  });

  for (const t of targets) await installSkillForTarget(t, dir, ask);
  rl.close();
}

async function installSkillForTarget(target, dir, ask) {
  console.log(c.dim(`\n  → ${target}`));

  if (target === 'cursor') {
    const destDir  = join(dir, '.cursor', 'rules');
    const destFile = join(destDir, 'vector-memory.mdc');
    const relPath  = '.cursor/rules/vector-memory.mdc';
    if (existsSync(destFile)) {
      const ok = await ask(`    ${relPath} ya existe. ¿Sobrescribir?`);
      if (!ok.startsWith('s') && !ok.startsWith('y')) { console.log(c.dim('    Omitido.')); return; }
    } else {
      const ok = await ask(`    ¿Crear ${relPath}?`);
      if (!ok.startsWith('s') && !ok.startsWith('y')) { console.log(c.dim('    Omitido.')); return; }
    }
    await mkdir(destDir, { recursive: true });
    await writeFile(destFile, CURSOR_RULE_CONTENT);
    console.log(c.green(`    ✓ ${relPath}`));
    return;
  }

  const skillContent = SKILL_CONTENT[target];
  if (!skillContent) { console.log(c.dim(`    Target no soportado: ${target}`)); return; }

  const isClaudeCode = target === 'claude-code';
  const targetFile   = isClaudeCode ? 'CLAUDE.md' : 'AGENTS.md';
  const filePath     = join(dir, targetFile);
  const marker       = '<!-- vector-memory-skill -->';

  let existing = '';
  if (existsSync(filePath)) existing = await readFile(filePath, 'utf-8');

  if (existing.includes(marker)) {
    console.log(c.dim(`    ${targetFile} ya contiene instrucciones de vector-memory`));
    return;
  }

  const block  = `\n${marker}\n${skillContent.trim()}\n<!-- /vector-memory-skill -->\n`;
  const action = existsSync(filePath)
    ? `¿Agregar instrucciones de vector-memory a ${targetFile}?`
    : `¿Crear ${targetFile} con instrucciones de vector-memory?`;
  const ok = await ask(`    ${action}`);
  if (!ok.startsWith('s') && !ok.startsWith('y')) { console.log(c.dim('    Omitido.')); return; }

  if (existsSync(filePath)) {
    await writeFile(filePath, existing.trimEnd() + '\n' + block);
  } else {
    await writeFile(filePath, `# ${targetFile}\n${block}`);
  }
  console.log(c.green(`    ✓ ${targetFile} actualizado`));
}

// ─── COMMAND: commands install ────────────────────────────────────────────────
async function cmdCommandsInstall(flags) {
  const target  = String(flags.target || 'all');
  const dir     = flags.dir ? resolve(flags.dir) : process.cwd();
  const yes     = !!flags.yes;
  const allTargets = ['claude-code', 'opencode'];
  const targets = target === 'all'
    ? allTargets
    : target.split(',').map(t => t.trim()).filter(t => allTargets.includes(t));

  if (!flags._noHeader) console.log(c.bold('\nvector-memory commands install\n'));

  if (targets.length === 0) {
    console.log(c.dim('  Slash commands disponibles para: claude-code, opencode'));
    console.log(c.dim('  Para cursor/codex/openclaw usa: vector-memory skills install\n'));
    return;
  }

  const rl  = createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(res => {
    if (yes) { res('s'); return; }
    rl.question(`  ${q} [S/n]: `, ans => res(ans.trim().toLowerCase() || 's'));
  });

  for (const t of targets) await installCommandsForTarget(t, dir, ask);
  rl.close();
}

async function installCommandsForTarget(target, dir, ask) {
  console.log(c.dim(`\n  → ${target}`));
  const commandsDir = target === 'claude-code'
    ? join(dir, '.claude', 'commands')
    : join(dir, '.opencode', 'commands');
  const relDir = commandsDir.startsWith(dir + '/') ? commandsDir.slice(dir.length + 1) : commandsDir;

  if (!existsSync(commandsDir)) {
    const ok = await ask(`    ¿Crear ${relDir} e instalar slash commands?`);
    if (!ok.startsWith('s') && !ok.startsWith('y')) { console.log(c.dim('    Omitido.')); return; }
    await mkdir(commandsDir, { recursive: true });
  }

  let installed = 0;
  for (const [name, def] of Object.entries(SLASH_COMMANDS)) {
    const file = join(commandsDir, `${name}.md`);
    if (existsSync(file)) { console.log(c.dim(`    ${name}.md ya existe`)); continue; }
    await writeFile(file, `# ${def.title}\n\n${def.content}\n`);
    console.log(c.green(`    ✓ ${name}.md`));
    installed++;
  }

  if (installed > 0) {
    const cmds = Object.keys(SLASH_COMMANDS).map(k => `/${k}`).join(', ');
    console.log(c.dim(`\n    Instalados en ${relDir}`));
    console.log(c.dim(`    Comandos: ${cmds}`));
  }
}

// ─── COMMAND: init --tools ────────────────────────────────────────────────────
async function cmdInitWithTools(flags) {
  const toolsRaw = String(flags.tools || 'claude-code');
  const tools    = toolsRaw.split(',').map(t => t.trim());
  const yes      = !!flags.yes;

  console.log(c.bold('\nvector-memory init --tools\n'));
  console.log(c.dim(`  Herramientas: ${tools.join(', ')}\n`));

  // 1. .vector-memory.json
  if (!findConfigFile()) {
    console.log(c.dim('  No se encontró .vector-memory.json — creando...\n'));
    await cmdInitProject({ ...flags, yes: true });
  } else {
    console.log(c.green('  ✓ .vector-memory.json ya existe'));
  }

  // 2. Skills
  await cmdSkillsInstall({ target: tools.join(','), yes, _noHeader: true });

  // 3. Slash commands
  await cmdCommandsInstall({ target: tools.join(','), yes, _noHeader: true });

  // 4. MCP config
  console.log(c.bold('\n  Configuración MCP:\n'));
  for (const tool of tools) {
    console.log(c.dim(`  ── ${tool} ──\n`));
    await cmdMcpConfig({ target: tool });
  }

  // 5. Próximos pasos
  console.log(c.bold('  Próximos pasos:\n'));
  console.log(`  ${c.cyan('vector-memory doctor')}           — verificar configuración`);
  console.log(`  ${c.cyan('vector-memory ingest')}            — indexar archivos del proyecto`);
  console.log(`  ${c.cyan('vector-memory worker --open')}     — abrir UI local\n`);
}

// ─── COMMAND: bank ────────────────────────────────────────────────────────────
async function cmdBank({ subcommand, args, flags }) {
  if (!subcommand || subcommand === 'help') {
    console.log('\n  Uso:');
    console.log('    vector-memory bank ls                   Lista todos los bancos de memoria');
    console.log('    vector-memory bank create <nombre>      Crea un banco de memoria nombrado');
    console.log('    vector-memory bank show   <nombre>      Estadísticas de un banco');
    console.log('\n  Nombres: proyecto   o   organización/proyecto');
    console.log('  Ejemplo: vector-memory bank create procesa/security-standards\n');
    return;
  }

  // create no necesita DB
  if (subcommand === 'create') {
    const name = args[0];
    if (!name) { console.error(c.red('  Uso: vector-memory bank create <nombre>')); process.exit(1); }

    const [org, project] = parseBankName(name);
    const banksFile      = join(homedir(), '.vector-memory-banks.json');
    let banks = {};
    if (existsSync(banksFile)) {
      try { banks = JSON.parse(await readFile(banksFile, 'utf-8')); } catch { /* */ }
    }
    if (banks[name]) {
      console.log(c.yellow(`\n  El banco "${name}" ya existe en ${banksFile}\n`));
      return;
    }
    banks[name] = {
      organization: org     || null,
      project:      project || null,
      description:  flags.description || flags.desc || '',
      created_at:   new Date().toISOString(),
    };
    await writeFile(banksFile, JSON.stringify(banks, null, 2) + '\n');
    console.log(c.bold('\nvector-memory bank create\n'));
    console.log(c.green(`  ✓ Banco "${name}" registrado en ${banksFile}\n`));
    console.log(c.dim('  Para agregar documentos:'));
    console.log(`  ${c.cyan(`vector-memory doc create ${name} <archivo>`)}\n`);
    return;
  }

  // ls y show necesitan DB
  const dbUrl = process.env.VECTOR_MEMORY_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) { console.error(c.red('  VECTOR_MEMORY_DATABASE_URL no configurado')); process.exit(1); }

  const pg     = await import('pg');
  const client = new pg.default.Client({ connectionString: dbUrl });
  await client.connect();

  try {
    if (subcommand === 'ls') {
      const res = await client.query(`
        SELECT
          COALESCE(organization, '') AS org,
          COALESCE(project, '')      AS project,
          COUNT(*)                   AS total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
          MAX(created_at)            AS latest
        FROM memories
        GROUP BY organization, project
        ORDER BY total DESC
      `);
      console.log(c.bold('\nvector-memory bank ls\n'));
      if (res.rows.length === 0) { console.log(c.dim('  No hay memorias en la base de datos.\n')); return; }
      for (const row of res.rows) {
        const bank   = [row.org, row.project].filter(Boolean).join('/') || c.dim('(sin banco)');
        const latest = row.latest ? new Date(row.latest).toISOString().slice(0, 10) : '—';
        console.log(
          `  ${c.cyan(bank.padEnd(36))}` +
          `  ${String(row.total).padStart(4)} memorias` +
          `  ${String(row.active).padStart(3)} activas` +
          `  ${c.dim(latest)}`
        );
      }
      console.log('');
    } else if (subcommand === 'show') {
      const name = args[0];
      if (!name) { console.error(c.red('  Uso: vector-memory bank show <nombre>')); process.exit(1); }
      await showBankStats(client, name);
    } else {
      console.log(c.yellow(`  Subcomando desconocido: ${subcommand}`));
    }
  } finally {
    await client.end();
  }
}

// ─── COMMAND: doc ─────────────────────────────────────────────────────────────
async function cmdDoc({ subcommand, args, flags }) {
  if (!subcommand || subcommand === 'help') {
    console.log('\n  Uso:');
    console.log('    vector-memory doc ls <banco>              Lista documentos de un banco');
    console.log('    vector-memory doc create <banco> <file>   Ingesta un archivo en un banco\n');
    return;
  }

  const dbUrl = process.env.VECTOR_MEMORY_DATABASE_URL || process.env.DATABASE_URL;

  if (subcommand === 'ls') {
    const name = args[0];
    if (!name) { console.error(c.red('  Uso: vector-memory doc ls <banco>')); process.exit(1); }
    if (!dbUrl) { console.error(c.red('  VECTOR_MEMORY_DATABASE_URL no configurado')); process.exit(1); }

    const [org, project] = parseBankName(name);
    const whereClause    = org ? `organization = $1 AND project = $2` : `project = $1`;
    const params         = org ? [org, project] : [project];

    const pg     = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      const res = await client.query(`
        SELECT public_id, source_path, memory_type, status, created_at,
               LEFT(content, 80) AS snippet
        FROM memories
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT 50
      `, params);
      console.log(c.bold(`\nvector-memory doc ls — ${name}\n`));
      if (res.rows.length === 0) { console.log(c.dim('  Sin documentos en este banco.\n')); return; }
      for (const r of res.rows) {
        const pid    = c.cyan((r.public_id || '—').padEnd(12));
        const date   = new Date(r.created_at).toISOString().slice(0, 10);
        const status = r.status !== 'active' ? c.yellow(` [${r.status}]`) : '';
        const path   = r.source_path ? c.dim(`  ${r.source_path}`) : '';
        console.log(`  ${pid}  ${c.dim(date)}${status}${path}`);
        console.log(`         ${r.snippet.replace(/\n/g, ' ')}…`);
      }
      console.log('');
    } finally {
      await client.end();
    }

  } else if (subcommand === 'create') {
    const name     = args[0];
    const filePath = args[1];
    if (!name || !filePath) {
      console.error(c.red('  Uso: vector-memory doc create <banco> <archivo>'));
      process.exit(1);
    }
    const [org, project] = parseBankName(name);
    if (org)     process.env.MEMORY_ORGANIZATION = org;
    if (project) process.env.MEMORY_PROJECT      = project;

    console.log(c.bold(`\nvector-memory doc create — ${name}\n`));
    console.log(c.dim(`  org=${org || '-'}  project=${project}  archivo=${filePath}\n`));
    await cmdIngest({ positional: [filePath], flags });

  } else {
    console.log(c.yellow(`  Subcomando desconocido: ${subcommand}`));
  }
}

// ─── COMMAND: manifest ────────────────────────────────────────────────────────
async function cmdManifest({ bankName, flags }) {
  if (!bankName) {
    console.error(c.red('  Uso: vector-memory manifest <banco>'));
    console.error(c.dim('  Ejemplo: vector-memory manifest procesa/security-standards'));
    process.exit(1);
  }
  const dbUrl = process.env.VECTOR_MEMORY_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) { console.error(c.red('  VECTOR_MEMORY_DATABASE_URL no configurado')); process.exit(1); }

  const [org, project] = parseBankName(bankName);
  const whereClause    = org ? `organization = $1 AND project = $2` : `project = $1`;
  const params         = org ? [org, project] : [project];

  const pg     = await import('pg');
  const client = new pg.default.Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const [statsRes, typesRes, critRes, tagsRes, verifiedRes] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*)                                                              AS total,
          SUM(CASE WHEN status = 'active'     THEN 1 ELSE 0 END)              AS active,
          SUM(CASE WHEN status = 'deprecated' THEN 1 ELSE 0 END)              AS deprecated,
          SUM(CASE WHEN criticality IN ('critical','high') THEN 1 ELSE 0 END) AS high_crit
        FROM memories WHERE ${whereClause}
      `, params),
      client.query(`
        SELECT memory_type, COUNT(*) AS n FROM memories
        WHERE ${whereClause} AND status = 'active'
        GROUP BY memory_type ORDER BY n DESC LIMIT 6
      `, params),
      client.query(`
        SELECT public_id, LEFT(content, 100) AS snippet FROM memories
        WHERE ${whereClause} AND criticality IN ('critical','high') AND status = 'active'
        ORDER BY criticality DESC, created_at DESC LIMIT 5
      `, params),
      client.query(`
        SELECT unnest(tags) AS tag, COUNT(*) AS n FROM memories
        WHERE ${whereClause} AND status = 'active' AND tags IS NOT NULL
        GROUP BY tag ORDER BY n DESC LIMIT 8
      `, params),
      client.query(`
        SELECT public_id, last_verified_at FROM memories
        WHERE ${whereClause} AND last_verified_at IS NOT NULL AND status = 'active'
        ORDER BY last_verified_at DESC LIMIT 3
      `, params),
    ]);

    const s = statsRes.rows[0];
    console.log(c.bold(`\n${bankName} — Manifest\n`));
    console.log(
      `  Memorias:   ${s.total} total` +
      `  |  ${s.active} activas` +
      `  |  ${s.deprecated} deprecated` +
      `  |  ${s.high_crit} críticas`
    );
    if (typesRes.rows.length)   console.log(`  Tipos:      ${typesRes.rows.map(r => `${r.memory_type}(${r.n})`).join(', ')}`);
    if (tagsRes.rows.length)    console.log(`  Tags:       ${tagsRes.rows.map(r => r.tag).join(', ')}`);

    if (critRes.rows.length) {
      console.log(`\n  ${c.yellow('Críticas / high:')}`);
      for (const r of critRes.rows) {
        console.log(`    ${c.cyan((r.public_id || '—').padEnd(12))}  ${r.snippet.replace(/\n/g, ' ')}…`);
      }
    }
    if (verifiedRes.rows.length) {
      console.log(`\n  ${c.dim('Verificadas recientemente:')}`);
      for (const r of verifiedRes.rows) {
        const d = new Date(r.last_verified_at).toISOString().slice(0, 10);
        console.log(`    ${c.cyan((r.public_id || '—').padEnd(12))}  ${c.dim(d)}`);
      }
    }

    const filterArg = org ? `--org ${org} --project ${project}` : `--project ${project || bankName}`;
    console.log(`\n  ${c.dim('Comandos sugeridos:')}`);
    console.log(`  ${c.cyan(`vector-memory search "<query>" ${filterArg}`)}`);
    console.log(`  ${c.cyan(`vector-memory iterate ${filterArg}`)}`);
    console.log('');
  } finally {
    await client.end();
  }
}

// ─── COMMAND: iterate ─────────────────────────────────────────────────────────
async function cmdIterate(flags) {
  console.log(c.bold('\nvector-memory iterate\n'));

  let effectiveProject = flags.project  || null;
  let effectiveOrg     = flags.org      || null;
  let effectiveRepo    = flags.repo     || null;
  const limit          = flags.limit ? parseInt(flags.limit, 10) : 20;

  // Auto-cargar desde config del proyecto si no se especificaron filtros
  if (!effectiveProject) {
    const loaded = await loadConfig();
    if (loaded?.config) {
      effectiveProject = loaded.config.project       || null;
      effectiveOrg     = loaded.config.organization  || null;
      effectiveRepo    = loaded.config.repo_name     || null;
    }
  }

  if (effectiveProject) {
    const bankLabel = [effectiveOrg, effectiveProject].filter(Boolean).join('/');
    console.log(c.dim(`  Banco: ${bankLabel}\n`));
  }
  console.log(c.dim('  Ejecutando Reflect...\n'));

  let reflectResult;
  let pool;
  try {
    const queryMod = await import(pathToFileURL(join(__dirname, 'query.js')).href);
    const dbMod    = await import(pathToFileURL(join(__dirname, 'db.js')).href);
    pool           = dbMod.default;
    reflectResult  = await queryMod.reflectMemories({
      project:  effectiveProject || undefined,
      org:      effectiveOrg     || undefined,
      repoName: effectiveRepo    || undefined,
      limit,
    });
  } catch (err) {
    console.error(c.red(`  Error: ${err.message}`));
    if (/openai|api.key/i.test(err.message)) {
      console.error(c.dim('  Asegúrate de que OPENAI_API_KEY esté en ~/.vector-memory.env'));
    }
    process.exit(1);
  } finally {
    await pool?.end().catch(() => {});
  }

  if (!reflectResult) { console.log(c.dim('  Sin resultados.\n')); return; }

  const {
    analyzed_count        = 0,
    summary               = '',
    findings              = [],
    suggested_new_memories   = [],
    suggested_deprecations   = [],
  } = reflectResult;

  console.log(`  Analizadas: ${c.cyan(String(analyzed_count))} memorias`);
  if (summary) console.log(`\n  ${summary}\n`);

  if (!findings.length && !suggested_new_memories.length && !suggested_deprecations.length) {
    console.log(c.green('\n  La base de conocimiento está en buen estado. Sin sugerencias.\n'));
    return;
  }

  if (findings.length > 0) {
    console.log(c.bold(`\n  Hallazgos (${findings.length}):\n`));
    for (const f of findings) {
      const badge = f.type === 'contradiction' ? c.red(`[${f.type}]`)
                  : f.type === 'duplicate'     ? c.yellow(`[${f.type}]`)
                  :                              c.dim(`[${f.type || 'gap'}]`);
      console.log(`  ${badge}  ${f.description}`);
      if (f.memory_ids?.length) console.log(c.dim(`         IDs: ${f.memory_ids.join(', ')}`));
      if (f.suggested_action)   console.log(c.dim(`         Acción: ${f.suggested_action}`));
      console.log('');
    }
  }

  if (suggested_deprecations.length > 0) {
    console.log(c.bold(`  Deprecaciones sugeridas (${suggested_deprecations.length}):\n`));
    for (const d of suggested_deprecations) {
      const id     = typeof d === 'string' ? d : (d.id || '?');
      const reason = typeof d === 'object'  ? d.reason : null;
      console.log(`  ${c.yellow('→')}  ${c.cyan(id)}${reason ? c.dim('  ' + reason) : ''}`);
    }
    console.log('');
  }

  if (suggested_new_memories.length > 0) {
    console.log(c.bold(`  Memorias nuevas sugeridas (${suggested_new_memories.length}):\n`));
    for (const m of suggested_new_memories) {
      const meta    = `[${m.memory_type || '?'}/${m.criticality || 'normal'}]`;
      const preview = (m.content || '').replace(/\n/g, ' ').slice(0, 120);
      console.log(`  ${c.green('+')}  ${c.dim(meta)}`);
      console.log(`     ${preview}`);
      if (m.tags?.length) console.log(c.dim(`     tags: ${m.tags.join(', ')}`));
      console.log('');
    }
  }

  console.log(c.dim('  Para aplicar sugerencias:'));
  console.log(c.dim('  • UI Reflect:  vector-memory worker --open'));
  console.log(c.dim('  • Via agente:  usa deprecate_memory / save_memory en tu agente MCP\n'));
}

// ─── Help ─────────────────────────────────────────────────────────────────────
function printHelp(unknown) {
  console.log(c.bold('\nvector-memory\n'));
  console.log('  Comandos:\n');
  console.log('    quickstart              Configuracion guiada desde cero');
  console.log('    init [--tools ...]      Inicializa el proyecto y configura agentes IA');
  console.log('    init-project            Crea .vector-memory.json con la config del repo');
  console.log('    doctor                  Verifica configuracion, DB y dependencias');
  console.log('    migrate                 Aplica el schema SQL en la DB');
  console.log('    ingest [path...]        Ingesta archivos usando la config del proyecto');
  console.log('    search <query>          Busca memorias por similitud semantica');
  console.log('    worker                  Inicia HTTP server con endpoints de eventos de sesion');
  console.log('    mcp-config              Genera snippet de config MCP copiable');
  console.log('    up                      docker compose up -d (solo PostgreSQL)');
  console.log('    down                    docker compose down\n');
  console.log('  Agentes IA:\n');
  console.log('    skills install          Instala instrucciones de uso en el agente');
  console.log('    commands install        Instala slash commands en el agente\n');
  console.log('  Memory banks:\n');
  console.log('    bank ls                 Lista todos los bancos de memoria');
  console.log('    bank create <nombre>    Crea un banco de memoria nombrado');
  console.log('    bank show   <nombre>    Estadisticas de un banco');
  console.log('    doc ls      <banco>     Lista documentos de un banco');
  console.log('    doc create  <banco> <file>  Ingesta un archivo en un banco');
  console.log('    manifest    <banco>     Resumen compacto de un banco');
  console.log('    iterate                 Ejecuta Reflect y presenta sugerencias de mejora\n');
  console.log('  Flags:\n');
  console.log('    --tools TOOLS         Herramientas para init: claude-code,cursor,codex,opencode,openclaw');
  console.log('    --target TARGET       Target para skills/commands: claude-code|cursor|opencode|codex|openclaw');
  console.log('    --dir DIR             Directorio base para skills/commands install');
  console.log('    --dry-run             Simula la ingesta sin guardar nada');
  console.log('    --secret-mode MODE    block|redact para ingesta (default: block)');
  console.log('    --limit N             Numero de resultados para search/iterate (default: 5/20)');
  console.log('    --repo NAME           Filtrar por repo_name');
  console.log('    --type TYPE           Filtrar por memory_type');
  console.log('    --status STATUS       Filtrar por status');
  console.log('    --org ORG             Filtrar por organizacion');
  console.log('    --project PROJECT     Filtrar por proyecto');
  console.log('    --yes                 Aceptar defaults (modo no interactivo)');
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
      await cmdInitProject(flags);
      break;
    case 'init':
      if (flags.tools) {
        await cmdInitWithTools(flags);
      } else {
        await cmdInitProject(flags);
      }
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
    case 'skills':
      await cmdSkillsInstall(flags);
      break;
    case 'commands':
      await cmdCommandsInstall(flags);
      break;
    case 'bank':
      await cmdBank({ positional, flags });
      break;
    case 'doc':
      await cmdDoc({ positional, flags });
      break;
    case 'manifest':
      await cmdManifest({ positional, flags });
      break;
    case 'iterate':
      await cmdIterate(flags);
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
