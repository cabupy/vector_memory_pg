// classify.js — Clasificación automática de memorias con OpenAI Chat
//
// Llama a GPT-4o-mini para sugerir memory_type, criticality y tags
// a partir del contenido de una memoria.
//
// Se usa como paso opcional en save_memory cuando auto_classify=true.
// Nunca bloquea: si falla devuelve null y el caller usa los valores manuales.

const CLASSIFY_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a technical knowledge classifier for a software development memory system.
Given a piece of technical content, you must respond with a JSON object (no markdown, no extra text) containing:
- memory_type: one of decision, architecture, security, bug, pattern, constraint, deployment, integration, convention, domain, session_summary, memory
- criticality: one of low, normal, high, critical
- tags: array of 2-5 lowercase keyword strings relevant to the content
- confidence: number between 0 and 1 indicating your confidence in the classification

Rules:
- security issues, vulnerabilities, or access control → criticality high or critical
- architectural decisions or constraints → criticality high
- bugs with production impact → criticality high
- minor notes or conventions → criticality low or normal
- tags should be technical terms, not generic words like "code" or "system"
- respond with valid JSON only, no explanation`;

/**
 * Clasifica automáticamente una memoria usando OpenAI Chat.
 *
 * @param {string} content
 * @returns {Promise<{ memory_type: string, criticality: string, tags: string[], confidence: number } | null>}
 */
export async function classifyMemory(content) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CLASSIFY_MODEL,
        temperature: 0,
        max_tokens: 200,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: content.slice(0, 2000) },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    const VALID_TYPES = new Set([
      "decision", "architecture", "security", "bug", "pattern",
      "constraint", "deployment", "integration", "convention",
      "domain", "session_summary", "memory",
    ]);
    const VALID_CRITICALITIES = new Set(["low", "normal", "high", "critical"]);

    return {
      memory_type: VALID_TYPES.has(parsed.memory_type) ? parsed.memory_type : "memory",
      criticality: VALID_CRITICALITIES.has(parsed.criticality) ? parsed.criticality : "normal",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8).map(String) : [],
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.7,
    };
  } catch {
    return null;
  }
}
