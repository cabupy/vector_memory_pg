import { basename, extname, normalize, sep } from "path";

const DENIED_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.test",
  "id_rsa",
  "id_ed25519",
  "credentials.json",
  "service-account.json",
]);

const DENIED_EXTENSIONS = new Set([".pem", ".key"]);

const DENIED_SEGMENTS = new Set([
  "secrets",
  ".secrets",
]);

export function getDeniedIngestReason(filePath) {
  const normalized = normalize(filePath);
  const name = basename(normalized);
  const extension = extname(name);
  const segments = normalized.split(sep).filter(Boolean);

  if (DENIED_BASENAMES.has(name) || name.startsWith(".env.")) {
    return `path bloqueado por política de secretos: ${name}`;
  }

  if (DENIED_EXTENSIONS.has(extension)) {
    return `extensión bloqueada por política de secretos: ${extension}`;
  }

  if (segments.some((segment) => DENIED_SEGMENTS.has(segment))) {
    return "path bloqueado por contener un directorio de secretos";
  }

  return null;
}

export function assertIngestAllowed(filePath) {
  const reason = getDeniedIngestReason(filePath);
  if (reason) throw new Error(reason);
}
