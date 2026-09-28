// No dependencies: Node's built-in fetch calls the TypeSafe HTTP API.
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const message = args.filter(arg => arg !== '--dry-run').join(' ').trim() || 'Hello, world!';
const replies = {
  greeting: 'Hello back! Your first Jev-powered decision worked.',
  farewell: 'Goodbye! Come back whenever you want to try another message.',
  other: 'That looks like something other than a greeting or farewell.',
};
const request = {
  model: process.env.TYPESAFE_MODEL || 'jev-latest',
  state: message,
  questions: {
    intent: {
      type: 'choice',
      instructions: 'Classify the primary communicative intent of this message.',
      criteria: {
        greeting: 'Opening a conversation or saying hello.',
        farewell: 'Ending a conversation or saying goodbye.',
        other: 'Any other intent, including requests, statements, or unclear messages.',
      },
    },
    friendly: {
      type: 'noul',
      instructions: 'Does this message express a friendly tone?',
    },
  },
};

async function main() {
  if (dryRun) {
    console.log('DRY RUN — request preview only; no API call or model result.');
    console.log(JSON.stringify(request, null, 2));
    return;
  }
  const key = process.env.TYPESAFE_API_KEY?.trim();
  if (!key) throw new Error('Add TYPESAFE_API_KEY to .env (see .env.example), then run npm start.');
  const started = performance.now();
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const hints = {
      401: 'Check your API key.',
      403: 'Check your account access.',
      422: 'The API rejected the request format or model.',
      429: 'Rate limit reached; wait before trying again.',
      529: 'TypeSafe is busy; wait before trying again.',
    };
    throw new Error(`TypeSafe HTTP ${response.status}. ${hints[response.status] || 'Please try again later.'}`);
  }
  const result = await response.json();
  const intent = result.answers?.intent;
  const friendly = result.answers?.friendly;
  const unit = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  if (!intent || !Object.hasOwn(replies, intent.choice) || !unit(intent.confidence) || !unit(friendly?.noul)) {
    throw new Error('Unexpected API response: missing or invalid decision values.');
  }
  const pct = n => `${(n * 100).toFixed(1)}%`;
  console.log(`\nYou: ${message}`);
  console.log(`Jev chose: ${intent.choice}`);
  console.log(`Choice confidence: ${pct(intent.confidence)}`);
  console.log(`Friendly probability: ${pct(friendly.noul)}`);
  // This threshold is illustrative, not a validated production policy.
  console.log(`Our app replies: ${intent.confidence >= 0.8 ? replies[intent.choice] : 'I am unsure how to classify that. Try another message.'}`);
  console.log(`Model: ${result.model} | Round trip: ${Math.round(performance.now() - started)} ms`);
  console.log('\nFull API result:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(`\n${error.name === 'TimeoutError' ? 'The API request timed out after 30 seconds.' : error.message}`);
  process.exitCode = 1;
});
