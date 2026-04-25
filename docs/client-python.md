# Cliente HTTP — Python

`vector-memory` expone una HTTP API REST en `http://localhost:3010`. Puedes
consumirla desde Python con `httpx`, `requests`, o cualquier cliente HTTP.
No hay SDK oficial: la API es REST pura.

Los ejemplos usan `httpx` (async y sync) y `requests` como alternativa.

---

## Instalacion de dependencias

```bash
pip install httpx          # recomendado (async + sync)
# o
pip install requests       # solo sync
```

---

## Configuracion base

```python
import os
import httpx

BASE_URL = os.getenv("VECTOR_MEMORY_URL", "http://localhost:3010")
```

---

## Buscar memorias

### Sincrono (requests)

```python
import requests

def search_memories(query: str, limit: int = 5, **filters) -> list[dict]:
    params = {"q": query, "limit": limit, **filters}
    res = requests.get(f"{BASE_URL}/query", params=params)
    res.raise_for_status()
    return res.json()

# Uso
results = search_memories(
    "rate limit JWT",
    limit=5,
    repo_name="api-service",
    criticality="high",
)
for r in results:
    print(f"[{r['score']:.3f}] {r['content'][:80]}")
```

### Asincrono (httpx)

```python
import httpx

async def search_memories(query: str, limit: int = 5, **filters) -> list[dict]:
    params = {"q": query, "limit": limit, **filters}
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{BASE_URL}/query", params=params)
        res.raise_for_status()
        return res.json()

# Uso en contexto async
import asyncio
results = asyncio.run(search_memories("autenticacion JWT", project="mi-proyecto"))
```

---

## Guardar una memoria

```python
import requests

def save_memory(
    content: str,
    memory_type: str = "memory",
    criticality: str = "normal",
    tags: list[str] | None = None,
    project: str | None = None,
    organization: str | None = None,
    repo_name: str | None = None,
) -> dict:
    payload = {
        "content": content,
        "memory_type": memory_type,
        "criticality": criticality,
    }
    if tags:         payload["tags"] = tags
    if project:      payload["project"] = project
    if organization: payload["organization"] = organization
    if repo_name:    payload["repo_name"] = repo_name

    res = requests.post(f"{BASE_URL}/memories", json=payload)
    res.raise_for_status()
    return res.json()

# Uso
save_memory(
    content="El rate limit esta en 100 req/min por IP. Configurado en el API gateway.",
    memory_type="architecture",
    criticality="high",
    tags=["rate-limit", "api-gateway"],
    project="mi-proyecto",
)
```

---

## Memorias recientes

```python
def recent_memories(limit: int = 10, project: str | None = None) -> list[dict]:
    params = {"limit": limit}
    if project:
        params["project"] = project
    res = requests.get(f"{BASE_URL}/recent", params=params)
    res.raise_for_status()
    return res.json()

recientes = recent_memories(5, project="mi-proyecto")
```

---

## Stats

```python
def memory_stats() -> dict:
    res = requests.get(f"{BASE_URL}/stats")
    res.raise_for_status()
    return res.json()

stats = memory_stats()
print(f"Total activas: {stats['by_status'].get('active', 0)}")
```

---

## Clase cliente

```python
from __future__ import annotations
import os
import httpx


class VectorMemoryClient:
    def __init__(self, base_url: str = "http://localhost:3010"):
        self.base_url = base_url.rstrip("/")

    def search(self, query: str, limit: int = 5, **filters) -> list[dict]:
        params = {"q": query, "limit": limit, **{k: v for k, v in filters.items() if v is not None}}
        with httpx.Client() as client:
            res = client.get(f"{self.base_url}/query", params=params)
            res.raise_for_status()
            return res.json()

    def save(self, content: str, **meta) -> dict:
        payload = {"content": content, **{k: v for k, v in meta.items() if v is not None}}
        with httpx.Client() as client:
            res = client.post(f"{self.base_url}/memories", json=payload)
            res.raise_for_status()
            return res.json()

    def recent(self, limit: int = 10, **filters) -> list[dict]:
        params = {"limit": limit, **{k: v for k, v in filters.items() if v is not None}}
        with httpx.Client() as client:
            res = client.get(f"{self.base_url}/recent", params=params)
            res.raise_for_status()
            return res.json()

    def stats(self) -> dict:
        with httpx.Client() as client:
            res = client.get(f"{self.base_url}/stats")
            res.raise_for_status()
            return res.json()


# Uso
mem = VectorMemoryClient()

resultados = mem.search("autenticacion JWT", limit=3, project="mi-proyecto")
for r in resultados:
    print(f"[{r['score']:.3f}] {r['content'][:100]}")

mem.save(
    "JWT configurado con RS256. Clave rotada cada 90 dias.",
    memory_type="security",
    criticality="high",
    tags=["jwt", "auth"],
    project="mi-proyecto",
)
```

---

## Integrar en el ciclo de vida de la sesion

```python
mem = VectorMemoryClient()

# Al inicio — recuperar contexto relevante
contexto = mem.search(tema_de_la_tarea, limit=5)
print("Contexto previo:")
for m in contexto:
    print(f"  - {m['content'][:80]}")

# ... trabajo ...

# Al final — guardar resumen
mem.save(
    resumen_de_la_sesion,
    memory_type="session_summary",
    criticality="normal",
    project=mi_proyecto,
)
```

---

## Version asincrona completa

```python
import asyncio
import httpx


class AsyncVectorMemoryClient:
    def __init__(self, base_url: str = "http://localhost:3010"):
        self.base_url = base_url.rstrip("/")

    async def search(self, query: str, limit: int = 5, **filters) -> list[dict]:
        params = {"q": query, "limit": limit, **{k: v for k, v in filters.items() if v is not None}}
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/query", params=params)
            res.raise_for_status()
            return res.json()

    async def save(self, content: str, **meta) -> dict:
        payload = {"content": content, **{k: v for k, v in meta.items() if v is not None}}
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{self.base_url}/memories", json=payload)
            res.raise_for_status()
            return res.json()


async def main():
    mem = AsyncVectorMemoryClient()
    results = await mem.search("rate limit", limit=3)
    print(results)

asyncio.run(main())
```

---

## Notas

- El servidor debe estar corriendo: `vector-memory worker`
- No hay autenticacion por defecto — el servidor escucha solo en `localhost`
- Para produccion o acceso desde red, considera un proxy con autenticacion
- Compatible con Python 3.10+
- `httpx` soporta tanto uso sincrono como asincrono; `requests` es solo sincrono
