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

const SECRET_PATTERNS = [
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["openai_api_key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["google_api_key", /\bAIza[0-9A-Za-z_-]{25,}\b/],
  ["aws_access_key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ["postgres_url", /\bpostgres(?:ql)?:\/\/[^\s'"`]+:[^\s'"`]+@[^\s'"`]+/i],
  ["mongodb_url", /\bmongodb(?:\+srv)?:\/\/[^\s'"`]+:[^\s'"`]+@[^\s'"`]+/i],
  ["generic_secret", /\b(?:api[_-]?key|secret|token|password|passwd|pwd)\b\s*[:=]\s*['"]?[^\s'"`]{12,}/i],
];

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

export function detectSecrets(content) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const [type, pattern] of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({ type, line: i + 1 });
      }
    }
  }

  return findings;
}

export function assertNoSecrets(content, filePath) {
  const findings = detectSecrets(content);
  if (findings.length === 0) return;

  const summary = findings
    .slice(0, 5)
    .map((finding) => `${finding.type} en línea ${finding.line}`)
    .join(", ");
  const suffix = findings.length > 5 ? ` y ${findings.length - 5} más` : "";

  throw new Error(
    `contenido bloqueado por posible secreto en ${filePath}: ${summary}${suffix}`
  );
}
