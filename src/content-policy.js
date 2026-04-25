// content-policy.js — Políticas de contenido para memorias
// Tags soportados:
//   @no-memory          → en cualquier parte del texto: la memoria NO se guarda
//   <private>...</private> → los bloques privados se eliminan antes de guardar

/**
 * Devuelve true si el contenido contiene @no-memory y no debe guardarse.
 */
export function shouldSkipMemory(content) {
  return /\@no-memory\b/i.test(content);
}

/**
 * Elimina bloques <private>...</private> del contenido.
 * Deja una marca [private] en su lugar para mantener la coherencia del texto.
 */
export function stripPrivateTags(content) {
  return content
    .replace(/<private>[\s\S]*?<\/private>/gi, '[private]')
    .replace(/\[private\](\s*\[private\])+/g, '[private]')  // colapsar múltiples
    .trim();
}

/**
 * Aplica todas las políticas de contenido sobre un texto.
 *
 * Devuelve:
 *   null     → si el contenido tiene @no-memory y debe omitirse completamente
 *   string   → contenido limpio (con <private> redactado) listo para guardar
 */
export function applyContentPolicy(content) {
  if (!content || typeof content !== 'string') return null;

  if (shouldSkipMemory(content)) return null;

  const clean = stripPrivateTags(content);
  return clean.length > 0 ? clean : null;
}
