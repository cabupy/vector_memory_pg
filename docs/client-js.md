# Cliente HTTP — JavaScript / TypeScript

`vector-memory` expone una HTTP API REST en `http://localhost:3010`. Puedes
consumirla desde cualquier proyecto JS/TS sin instalar ningun SDK adicional:
usa `fetch` nativo (Node 18+) o cualquier cliente HTTP.

---

## Configuracion base

```ts
const BASE_URL = process.env.VECTOR_MEMORY_URL ?? 'http://localhost:3010'
```

---

## Buscar memorias

```ts
async function searchMemories(query: string, filters?: {
  project?: string
  repo_name?: string
  memory_type?: string
  criticality?: string
  limit?: number
}) {
  const params = new URLSearchParams({ q: query, limit: String(filters?.limit ?? 5) })
  if (filters?.project)     params.set('project', filters.project)
  if (filters?.repo_name)   params.set('repo_name', filters.repo_name)
  if (filters?.memory_type) params.set('memory_type', filters.memory_type)
  if (filters?.criticality) params.set('criticality', filters.criticality)

  const res = await fetch(`${BASE_URL}/query?${params}`)
  return res.json()
}

// Uso
const results = await searchMemories('rate limit JWT', {
  repo_name: 'api-service',
  criticality: 'high',
  limit: 5,
})
console.log(results)
```

---

## Guardar una memoria

```ts
async function saveMemory(data: {
  content: string
  memory_type?: string
  criticality?: string
  tags?: string[]
  project?: string
  organization?: string
  repo_name?: string
}) {
  const res = await fetch(`${BASE_URL}/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

// Uso
await saveMemory({
  content: 'El rate limit esta en 100 req/min por IP. Configurado en el API gateway, no en la app.',
  memory_type: 'architecture',
  criticality: 'high',
  tags: ['rate-limit', 'api-gateway'],
  project: 'mi-proyecto',
})
```

---

## Memorias recientes

```ts
async function recentMemories(limit = 10, project?: string) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (project) params.set('project', project)
  const res = await fetch(`${BASE_URL}/recent?${params}`)
  return res.json()
}

const recientes = await recentMemories(5, 'mi-proyecto')
```

---

## Stats

```ts
async function memoryStats() {
  const res = await fetch(`${BASE_URL}/stats`)
  return res.json()
}

const stats = await memoryStats()
console.log(`Total memorias activas: ${stats.by_status.active}`)
```

---

## Guardar resumen de sesion

```ts
async function saveSessionSummary(summary: string, project?: string) {
  return saveMemory({
    content: summary,
    memory_type: 'session_summary',
    criticality: 'normal',
    project,
  })
}

await saveSessionSummary(
  'Se implemento autenticacion JWT. Decision: tokens de 1h con refresh de 7d. Pendiente: revocar tokens.',
  'mi-proyecto',
)
```

---

## Clase cliente (TypeScript)

Si prefieres una abstraccion orientada a objetos:

```ts
export class VectorMemoryClient {
  constructor(private baseUrl = 'http://localhost:3010') {}

  async search(query: string, opts?: { limit?: number; project?: string; repo_name?: string }) {
    const params = new URLSearchParams({ q: query, limit: String(opts?.limit ?? 5) })
    if (opts?.project)   params.set('project', opts.project)
    if (opts?.repo_name) params.set('repo_name', opts.repo_name)
    const res = await fetch(`${this.baseUrl}/query?${params}`)
    if (!res.ok) throw new Error(`search failed: ${res.status}`)
    return res.json()
  }

  async save(content: string, meta?: Record<string, unknown>) {
    const res = await fetch(`${this.baseUrl}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, ...meta }),
    })
    if (!res.ok) throw new Error(`save failed: ${res.status}`)
    return res.json()
  }

  async recent(limit = 10) {
    const res = await fetch(`${this.baseUrl}/recent?limit=${limit}`)
    if (!res.ok) throw new Error(`recent failed: ${res.status}`)
    return res.json()
  }

  async stats() {
    const res = await fetch(`${this.baseUrl}/stats`)
    if (!res.ok) throw new Error(`stats failed: ${res.status}`)
    return res.json()
  }
}

// Uso
const mem = new VectorMemoryClient()
const results = await mem.search('autenticacion JWT', { limit: 3 })
await mem.save('JWT configurado con RS256, clave rotada cada 90 dias.', {
  memory_type: 'security',
  criticality: 'high',
  tags: ['jwt', 'auth'],
})
```

---

## Integrar en el ciclo de vida de la sesion

```ts
// Al inicio del proceso / sesion
const contexto = await mem.search(tema)
console.log('Contexto previo:', contexto.map(m => m.content).join('\n'))

// ... trabajo ...

// Al final
await mem.save(resumenDeLaSesion, { memory_type: 'session_summary' })
```

---

## Notas

- El servidor debe estar corriendo: `vector-memory worker`
- No hay autenticacion por defecto — el servidor escucha solo en `localhost`
- Para produccion o acceso desde red, considera un proxy con autenticacion
- `fetch` nativo esta disponible en Node.js 18+; para versiones anteriores
  usa `node-fetch` o `undici`
