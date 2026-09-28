# Our Unity demo team

## Roles

| Role | Responsibility |
| --- | --- |
| User — creative director | Choose the game concept, feel, and next milestone; play and give feedback. |
| Main assistant — coordinator and builder | Develop options with the user, prepare Jev questions, implement the agreed milestone, and explain the result. |
| Jev — decision specialist | Compare supplied options using the TypeSafe API. Return a choice, probabilities, and confidence. |
| Reviewer agent | Independently review the current milestone against the brief and verification evidence. Report concrete defects and untested behavior. |

The coordinator and builder are one agent in this first version. The reviewer is
created on demand using the host's subagent capability; no background worker or
autonomous game-building loop runs from these files. If subagents are unavailable,
report that limitation and distinguish a self-review from an independent review.

## Working together

1. Discuss the next small, playable or inspectable milestone with the user.
2. When a useful choice emerges, state the question, options, and assumptions.
   Use Jev on requests such as “ask Jev” or when the agreed milestone includes a
   Jev decision. The user should not have to construct JSON or run commands.
3. Show the actual Jev result, including uncertainty. Discuss what it means for
   the game and let the user choose the direction. Do not mistake a recommendation
   for an instruction to start a new milestone.
4. Build the agreed piece. Resolve routine implementation details autonomously
   within it; do not interrupt for approval on each file edit or test.
5. Give a reviewer the agreed requirements, changed files, and observed test
   results. Ask it to review rather than implement. Fix defects within scope.
6. Present what changed and how the user can try it. Get their feedback before
   choosing the next milestone together.

Update `BRIEF.md` with decisions actually agreed in conversation. Preserve the
distinction between a Jev suggestion, a user choice, and an implemented result.

## Jev connection

Read `../skills/jev-decide/SKILL.md` and use its existing helper:

```sh
node --env-file-if-exists=.env skills/jev-decide/scripts/decide.mjs <decision.json> --live
```

Run from the repository root. Prepare a narrow question and actual candidate
options using the current milestone context. Avoid loading the whole conversation
or unrelated files into the request. Keep private decision inputs in the ignored
`.jev/` directory when local persistence is useful.

Show the chosen option, reported confidence, and measured round-trip time. If the
helper returns fallback, show its reason and discuss the choice with the user.
Jev returns decisions, not written explanations: label the coordinator's
interpretation as such. Do not invent a rationale and attribute it to Jev.

Jev may inform design choices, implementation approaches, investigation targets,
and test order. It does not choose the game concept on the user's behalf, waive
required checks, or authorize publishing. An existing authorization to publish
still applies to the agreed scope; publication is separate from a Jev recommendation.

## Reviewer handoff

Provide the reviewer with:

- The current milestone and the user's acceptance criteria.
- Paths to the relevant implementation and the change summary.
- Checks actually run and their results, including any Unity compilation limits.

Ask for defects with file references, missing checks, and a short verdict. Do not
claim Unity compilation or play testing passed based only on a model's review.
