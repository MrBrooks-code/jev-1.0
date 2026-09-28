# Collaborative Unity demo team

Read `team/TEAM.md` for roles and the collaboration loop, and `team/BRIEF.md`
for the current agreed scope. The user wants to create the Unity demo with us:
keep game design and milestone choices in the conversation. Implement the agreed
piece, then return something the user can inspect or try before expanding it.

## Local Jev skill

When the user asks to “use Jev,” “ask Jev,” “consult Jev,” “let Jev decide,”
“run this by Jev,” or a similar conversational variant, read and apply
`skills/jev-decide/SKILL.md`. Match intent rather than exact spelling or casing.

Infer the decision from the current task. The skill prepares candidate choices and
calls the local helper; the user does not need to provide JSON or a skill path.
Discussion of Jev or requests to edit the skill do not themselves trigger an API call.
