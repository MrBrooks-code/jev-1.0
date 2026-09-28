import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const unit = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const MAX_BYTES = 48_000; // A local request budget, not a tokenizer/context estimate.
export function prepare(input, model = 'jev-latest') {
  if (!object(input) || typeof input.question !== 'string' || !input.question.trim())
    throw new Error('Supply a nonempty question.');
  if (!(typeof input.state === 'string' || object(input.state) || Array.isArray(input.state)))
    throw new Error('Supply state as text, an object, or an array.');
  if (!object(input.options)) throw new Error('Supply an options object.');
  const entries = Object.entries(input.options);
  if (entries.length < 2 || entries.length > 254 || entries.some(([id, description]) =>
    !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || id === 'unclear' ||
    typeof description !== 'string' || !description.trim()))
    throw new Error('Supply 2–254 described options with simple IDs; unclear is reserved.');
  const floor = input.min_confidence ?? 0.8;
  if (!unit(floor)) throw new Error('min_confidence must be between 0 and 1.');
  const margin = input.min_margin ?? 0.15;
  if (!unit(margin)) throw new Error('min_margin must be between 0 and 1.');
  return {
    floor, margin,
    payload: {
      model,
      state: input.state,
      questions: { decision: {
        type: 'choice',
        instructions: input.question,
        criteria: { ...input.options, unclear: 'Insufficient evidence or none of the supplied options fits.' },
      } },
    },
  };
}

export async function decide(input, { live = false, privateMode = false, key, model = 'jev-latest', fetchImpl = fetch } = {}) {
  const fallback = (reason, called = false) => ({ status: 'fallback', selected: null, jev_called: called, reason });
  if (privateMode) return fallback('private_request');
  const { payload, floor, margin } = prepare(input, model);
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body) > MAX_BYTES) return fallback('payload_budget_exceeded');
  // Block the exact configured credential even in previews. This is not general DLP.
  if (key?.trim() && body.includes(key.trim())) return fallback('api_key_in_payload');
  if (!live) return { status: 'preview', jev_called: false, payload, policy: { min_confidence: floor, min_margin: margin } };
  if (!key?.trim()) return fallback('missing_api_key');
  const start = performance.now();
  let result;
  try {
    const response = await fetchImpl('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return fallback(`http_${response.status}`, true);
    result = await response.json();
  } catch {
    // Avoid echoing server bodies, input, or credentials in errors.
    return fallback('network_timeout_or_invalid_json', true);
  }
  const answer = result?.answers?.decision;
  const criteria = payload.questions.decision.criteria;
  const probabilities = answer?.probabilities;
  if (answer?.type !== 'choice' || !Object.hasOwn(criteria, answer.choice) ||
      !unit(answer.confidence) || !object(probabilities) ||
      Object.keys(probabilities).length !== Object.keys(criteria).length ||
      Object.keys(criteria).some(id => !Object.hasOwn(probabilities, id) || !unit(probabilities[id])) ||
      Math.abs(Object.values(probabilities).reduce((a, b) => a + b, 0) - 1) > 0.01 ||
      probabilities[answer.choice] + 1e-6 < Math.max(...Object.values(probabilities)) ||
      typeof result.model !== 'string') return fallback('invalid_api_answer', true);
  const ranked = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  const gap = ranked[0][1] - ranked[1][1];
  const accepted = answer.choice !== 'unclear' && answer.confidence >= floor && gap >= margin;
  return {
    status: accepted ? 'recommendation' : 'fallback',
    jev_called: true,
    selected: accepted ? answer.choice : null,
    reason: accepted ? null : answer.choice === 'unclear' ? 'unclear' : answer.confidence < floor ? 'low_confidence' : 'close_alternatives',
    answer: { type: 'choice', choice: answer.choice, confidence: answer.confidence, probabilities },
    margin: gap,
    policy: { min_confidence: floor, min_margin: margin },
    model: result.model,
    usage: object(result.usage) && ['input_tokens', 'output_tokens'].every(k => Number.isSafeInteger(result.usage[k]) && result.usage[k] >= 0)
      ? { input_tokens: result.usage.input_tokens, output_tokens: result.usage.output_tokens } : null,
    elapsed_ms: Math.round(performance.now() - start),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--doctor') {
    console.log(JSON.stringify({ node: process.version, key_configured: Boolean(process.env.TYPESAFE_API_KEY?.trim()), model: process.env.TYPESAFE_MODEL || 'jev-latest', network: false }));
    return;
  }
  if (args.length < 1 || args[0].startsWith('--') || args.slice(1).some(a => !['--live', '--private'].includes(a)))
    throw new Error('Usage: node decide.mjs decision.json [--live] [--private], or --doctor');
  if (args.includes('--private')) {
    console.log(JSON.stringify(await decide(null, { privateMode: true })));
    process.exitCode = 2;
    return;
  }
  if (statSync(args[0]).size > MAX_BYTES) throw new Error('Input exceeds the 48 KB local budget.');
  let input;
  try { input = JSON.parse(readFileSync(args[0], 'utf8')); }
  catch { throw new Error('Cannot read input JSON. Check its path and syntax.'); }
  const result = await decide(input, {
    live: args.includes('--live'), key: process.env.TYPESAFE_API_KEY,
    model: process.env.TYPESAFE_MODEL || 'jev-latest',
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'fallback' ? 2 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.log(JSON.stringify({ status: 'error', jev_called: false, reason: error.message }));
    process.exitCode = 1;
  });
}
