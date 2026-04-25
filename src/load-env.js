// load-env.js — Carga de variables de entorno con prioridad correcta
//
// Orden (el primero en setear una var gana — dotenv no override por default):
//   1. Shell / variables ya en process.env (más alta prioridad)
//   2. ~/.vector-memory.env — config global del usuario, independiente del proyecto
//   3. .env del CWD          — puede pertenecer a otro proyecto
//
// Var recomendada:  VECTOR_MEMORY_DATABASE_URL
// Var de fallback:  DATABASE_URL  (compatibilidad con setups existentes)

import dotenv from "dotenv";
import { join } from "path";
import { homedir } from "os";

dotenv.config({ path: join(homedir(), ".vector-memory.env") });
dotenv.config();

/**
 * Devuelve la URL de conexión a PostgreSQL para vector-memory.
 * VECTOR_MEMORY_DATABASE_URL tiene prioridad sobre DATABASE_URL genérico.
 */
export function getDatabaseUrl() {
  return process.env.VECTOR_MEMORY_DATABASE_URL || process.env.DATABASE_URL || null;
}
