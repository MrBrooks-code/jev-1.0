# Jev hello world

## Collaborative Unity team

Our [team agreement](team/TEAM.md) connects the existing Jev helper to a
collaborative workflow: the user directs, the main assistant coordinates and
builds, Jev recommends, and an on-demand reviewer checks each milestone.
The [shared brief](team/BRIEF.md) tracks the agreed scope. These are agent
instructions; they do not launch an autonomous team or generate a game on their own.

## Try our decision skill

The skill source is `skills/jev-decide/SKILL.md`; it is not globally installed yet.
After configuring `.env` as described below, run:

```sh
npm run jev:check
npm run jev:preview
npm run jev:try
```

The example asks which component to investigate in a fictional invoice-download
failure. `invoice_rendering` is the expected choice given the supplied evidence;
the actual API result may differ or fall back. Edit `examples/decision.json` to
change the scenario or options. Preview makes no network call; try makes one live call.
The result contains a recommendation or a fallback reason, plus probabilities and
timing when a valid answer is received. `npm test` runs offline transport fixtures,
not a model-quality benchmark.

To try the skill in this project, say “Use Jev on the example” or “Ask Jev which
component to investigate.” `AGENTS.md` routes these natural-language requests to
the local skill. Global installation is not required for this project.

A tiny terminal demo: Jev classifies your message as a greeting, farewell, or other,
and estimates whether it sounds friendly. Our code selects a fixed reply using
the decision. The reply is written by us; Jev supplies the decision.

## Try it

Requires Node.js 22+. No packages to install.

1. Copy `.env.example` to `.env`.
2. Get an API key from https://console.typesafe.ai and enter it after
   `TYPESAFE_API_KEY=` in `.env`. This file is ignored by Git. Keep your key local.
3. Run:

```sh
npm start
npm start -- "Hey there, nice to meet you!"
npm start -- "Goodbye, see you tomorrow."
npm start -- "What is the weather?"
```

The live demo sends your message to TypeSafe and uses your API account.
It prints the classification, confidence, friendliness probability, measured
round-trip time, and full API response. Confidence and probability are different
quantities; neither guarantees correctness. The 0.8 reply threshold is only an
example for this demo.

Without a key, preview the exact request (no model call and no simulated answers):

```sh
npm run demo
```

## How it connects

`hello.mjs` posts state and two typed questions to
`https://api.typesafe.ai/v1/systemone`, using `jev-latest` by default.
Set `TYPESAFE_MODEL` in `.env` to select a specific available model.
Authentication errors, rate limits, and timeouts produce an error and nonzero exit.
This small demo makes one request per run with no automatic retries.

References: [Quick start](https://docs.typesafe.ai/introduction/quickstart)
and [API reference](https://docs.typesafe.ai/api).
