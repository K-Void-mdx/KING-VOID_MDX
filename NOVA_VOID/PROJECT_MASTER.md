# NOVA_VOID MDX — MASTER PROJECT PLAN & HANDOFF

> **Status:** Master handoff document
>
> **Project:** NOVA_VOID MDX
>
> **Repository:** `K-Void-mdx/KING-VOID_MDX`
>
> **Stable branch:** `main`
>
> **Purpose:** Preserve the complete project history, requirements, architecture, decisions, current verified state, and continuation plan so another AI/developer can continue without making the owner repeat the entire conversation.

---

## 0.1 CONTINUATION LOG (update after each work batch)

### Batch 2026-08-23 — repo hygiene + core hardening (status: IMPLEMENTED, unit-tested)

Repository hygiene:
- Root `.gitignore` repaired (was `node_modules/` only). Now blocks `sessions/`, `data/`, `.env`, caches, crash dumps.
- `sessions/` (38,969 files incl. `creds.json`) and `.npm-cache/` UNTRACKED from git index. Local files untouched.
- Deleted 7.5 GB `core` crash dump. Archived dead CODY-AI experiments (`?.js`, `?.js[old]`, `consolelog.txt`) to `~/.nova_trash/`.
- Tracked file count reduced 40,768 → ~552.

NOVA_VOID core (all in NOVA_VOID/, ESM, deps: baileys + pino only):
- Persistence added: chatbot state (`data/chatbot-state.json`), per-session history files (`data/history/`, capped), training memory (`data/memory.json`). Atomic JSON writes via new `src/core/storage/json-store.js`.
- `src/config/env.js`: loads `.env` itself (no dotenv dep), multi `OWNER_JIDS`/`SUDO_JIDS`, `PAIR_PHONE`, `AI_MAX_HISTORY`; paths resolved relative to NOVA_VOID/ regardless of cwd. Default BOT_NAME = "NOVA_VOID MDX".
- `src/index.js`: pairing-code login flow for fresh installs; no per-boot version fetch (saves data); reconnect resets application; loggedOut handled explicitly.
- Fixed pre-existing boot crash: `application.register()` failed on single-command factories (`.flat()` on non-array).
- Chatbot path now answers honestly when no provider is configured instead of throwing silently.
- `.history` gated to owner/trusted at dispatcher level (`role: 'sudo'`). `.clear-h all` remains owner-only. Self-clear allowed to any user for their own data.
- Per-user rate limiting on chatbot + `.ai` (`src/core/rate-limit.js`).
- New Tier-1 commands: `.ping`, `.menu`, `.status`.
- Tests expanded to 9 (persistence round-trips, rate limiter, role hierarchy, triggers). All pass; all sources pass `node --check`.

Still NOT done / next:
- Provider adapters not connected: `.ai`/`.generate` honestly report "not configured". No keys exist; do not fake them.
- Runtime verification against live WhatsApp requires installing baileys+pino into NOVA_VOID/ (~small download) — the ONLY pending internet need.
- Old-bot command audit (467 legacy command files in src/Commands) — classify KEEP/MERGE/REMOVE before porting toward the 150–200 target.
- Dependency pruning of root package.json (4 competing baileys forks etc.) after old-bot decision.

### Batch 2026-08-23 (later) — full local review + legacy command audit

Review results:
- Found and fixed a real `.gitignore` bug: unanchored `core` pattern silently ignored `src/core/` source files. All ignore patterns now anchored (`/core`, `/data/`, `/sessions/`).
- Verified: zero auth material staged; zero auth files tracked; `core` dump was never tracked (deletion lost nothing); archived CODY files referenced only by comments.
- ⚠️ KNOWN ISSUE (reported, NOT fixed): `sessions/creds.json` and other session material remain in LOCAL git history (commit `58ebbfaf` "My version of King Void MDx") and possibly on origin. Do-not-rewrite rule respected. Mitigations before any commercial use: re-pair fresh (invalidates old keys), then decide on history rewrite / repo cleanup WITH owner approval.
- ⚠️ Third-party API keys found hardcoded (and thus already leaked) in legacy commands: RapidAPI key ×2 files, Freesound token ×2 files, weather API key ×1. If these belong to the owner, revoke/regenerate and use `.env`. Never copy them into NOVA_VOID.
- Legacy entry chain `index.js → ☁︎.js → ⚉.js` is OBFUSCATED (78 obfuscated js files overall) with CRYSNOVA/ZEE-BOT branding, hardcoded newsletter JID, catbox CDN URLs, and a fallback owner phone number in `settings/config.js`. Per §40 this whole chain stays REFERENCE-ONLY.

Legacy command inventory (static analysis, nothing executed):
- 457 command files → 352 declare a `name:` (~347 unique); 105 are non-standard utilities/classes.
- 1,698 alias declarations with 816 colliding aliases (legacy loader silently keeps first-come).
- 5 duplicate command names across categories (weather, online, rapidapi, bank, comic2).
- Abuse surface: `src/Commands/B×͜×☠︎︎/` (bug/crash tooling incl. `filebomb`) → REMOVE entirely. No attack/crash/freeze/spam/mass-report commands may be migrated.

Command migration strategy (target ≈150–200 useful commands):
| Wave | Source categories | Est. keep | Rules |
|---|---|---|---|
| 1 | Core/System/Bot basics | ~10 | menu/help/ping/status/runtime/settings |
| 2 | Owner + Admin | ~35–45 | central role enforcement; no shell/eval |
| 3 | Group management | ~20 | promote/kick/welcome/antibulk hygiene |
| 4 | Utility/Converter/Documents | ~40–50 | best-of; merge duplicates first |
| 5 | Media/Media-Editor | ~20–25 | requires ffmpeg/sharp decision later |
| 6 | Downloader/Search | ~15–25 | lawful sources only; env-based keys; drop dead APIs |
| 7 | Fun/Games/Quiz/Anime | ~15–20 | low priority |

Global rules: skip all 78 obfuscated files unless behavior is re-implemented cleanly; every ported command declares name/aliases/category/description/usage/role; aliases capped (~2–3 each); duplicate names rejected at registration (already enforced); any external API key must come from `.env`; rate-limit expensive commands. Realistic landing zone: ~150–180 commands.



---

## 0. READ THIS FIRST

This document is the project's source of truth for **intent and direction**.

The repository itself is the source of truth for **what is actually implemented**.

If this document says a feature is planned but the code does not implement it, treat the feature as **PLANNED**.

If code exists but has not been tested end-to-end, treat it as **IMPLEMENTED — NOT YET VERIFIED END-TO-END**.

Never report a feature as production-ready merely because a file or interface exists.

### Working rule

```text
READ → INSPECT ACTUAL REPO → IMPLEMENT → TEST → FIX → COMMIT → REPORT
```

Do not invent status.

---

# 1. PROJECT IDENTITY

**Name:** NOVA_VOID MDX

**Repository:** `K-Void-mdx/KING-VOID_MDX`

**Platform:** WhatsApp bot

**Development device:** Android phone

**Development environment:** Termux

**Architecture:** ARM64 / `aarch64`

**Long-term objective:** Build a clean, reliable, maintainable WhatsApp bot that can eventually be packaged and sold legitimately for profit.

---

# 2. OWNER'S REAL-WORLD CONSTRAINTS

The owner is developing entirely from a phone and does not have a PC.

Known environment at the time of this document:

- Android 14
- ARM64 / `aarch64`
- Termux 0.118.3
- F-Droid Termux build
- Node.js `v26.4.0`
- Device reported as itel P665L

The owner previously used:

```bash
proot-distro login debian2
```

for OpenCode work.

The owner abandoned that workflow because it was not satisfactory and wants to avoid unnecessary downloads.

### Critical resource constraint

The owner has limited mobile data and does not want to waste data installing unnecessary operating systems, packages, agents, models, or dependencies.

Therefore:

- Prefer direct Termux compatibility where practical.
- Do not reinstall Debian/PRoot without a real requirement.
- Do not recommend multiple coding agents when one is sufficient.
- Do not make the owner download a huge stack before confirming it is needed.
- Keep setup instructions minimal.

---

# 3. HOW THE PROJECT STARTED

The owner had two repositories that represented the same general WhatsApp-bot project/function:

1. `K-Void-mdx/King-Void-MDX`
2. `K-Void-mdx/KING-VOID_MDX`

The owner had been using OpenCode Zen through Termux/PRoot to develop the bot.

OpenCode Zen was not producing the quality/workflow the owner wanted, so that approach was abandoned.

The owner asked for a deep comparison of the two repositories to determine which one was more complete and which should become the foundation.

The repositories were understood as the older **Levanter** direction and the newer **Crysnova/Baileys** direction.

The decision was not to blindly keep either codebase.

Instead:

> **Use `KING-VOID_MDX` as the primary feature/reference source, use the older Levanter project as secondary historical reference, and build NOVA_VOID as a cleaner architecture.**

---

# 4. REPOSITORY DECISION

## 4.1 `King-Void-MDX` / Levanter

### Role

Historical/reference implementation.

### Useful material

- Existing bot behavior
- Historical feature implementations
- Framework ideas
- Useful command concepts
- Existing logic that may be worth reimplementing

### Problems

The project is too large/monolithic for direct reuse as the clean NOVA_VOID core.

Some areas are difficult to maintain or understand.

### Final decision

**REFERENCE ONLY.**

Do not copy the whole architecture.

---

## 4.2 `KING-VOID_MDX` / Crysnova-Baileys direction

### Role

Primary reference/source repository.

### Useful material

- Larger modular command collection
- Existing AI-related code
- Media functionality
- Downloader functionality
- Owner/admin/sudo concepts
- WhatsApp message handling ideas
- Command/plugin patterns

### Problems found during the architectural review

- Dependency bloat
- Multiple/competing WhatsApp implementations
- Large configuration surface
- Large message-handling responsibilities
- Security-sensitive configuration patterns that should not be copied
- Updater design that is unsuitable for a commercial product
- Large or difficult-to-maintain implementations
- Too many responsibilities mixed together

### Final decision

**PRIMARY REFERENCE.**

Extract useful behavior, but rebuild the core cleanly.

---

# 5. NAME CHANGE

The owner chose the final project name:

> **NOVA_VOID MDX**

Future user-facing branding should use NOVA_VOID unless a later explicit decision changes the name.

Do not retain old bot branding in new user-facing output except where required for historical attribution or compatibility.

---

# 6. PRODUCT VISION

NOVA_VOID should become:

- A reliable WhatsApp bot.
- Modular.
- Easy to configure.
- Termux-friendly.
- Lightweight where practical.
- Secure.
- Maintainable.
- Extensible.
- Useful for groups and private chats.
- Equipped with a small but useful AI assistant.
- Capable of supporting media/download/utility features.
- Designed with eventual commercial distribution in mind.

The objective is **not** to create the biggest bot.

The objective is to create a bot that is **better organized, easier to maintain, and more useful**.

> Quality > command count.

---

# 7. OWNER'S IDEAL WORKFLOW

The owner repeatedly requested this workflow:

```text
WORK ON A GO
    ↓
CHECK
    ↓
FIX
    ↓
CONTINUE
    ↓
CHECK AGAIN
    ↓
ASK ONLY WHEN NECESSARY
```

The owner does not want repeated explanations of things already decided.

If a requirement is already in this document, do not ask the owner to repeat it.

If a coding decision is obvious and low-risk, make the decision and continue.

If a decision can destroy data, credentials, stable branches, or user configuration, stop and ask before doing it.

---

# 8. CHATGPT / CODING-AGENT LIMITATION

The owner wanted an AI that could keep working continuously, similar to:

```text
work → ask → continue → work → ask → continue
```

A chat assistant cannot literally maintain an invisible background coding session after a response.

Therefore the practical workflow is:

- Make large meaningful batches of repository work in each active turn.
- Use GitHub as the persistent project state.
- Keep this document as the persistent project memory.
- Use a Termux coding agent later if a continuous local coding loop is desired.

Never claim that unattended background work is occurring when it is not.

---

# 9. GITHUB WORKFLOW

The owner connected the GitHub integration and asked the assistant to make repository changes directly.

The repository is:

`K-Void-mdx/KING-VOID_MDX`

The NOVA_VOID rebuild was initially developed on:

`nova-void-rebuild`

The owner later merged that rebuild into `main` through Pull Request #1.

Therefore:

> **`main` is now the stable NOVA_VOID checkpoint.**

Future risky work should use a feature/development branch and then be merged after review.

### Branch rule

```text
main = stable checkpoint
feature/* or development branch = experimental work
```

Do not overwrite stable `main` with untested experiments.

---

# 10. AI SYSTEM — OWNER'S REQUIREMENTS

The owner explicitly does **not** want a huge AI command system.

The intended AI system is small and useful.

Core AI features:

1. `.chatbot on/off`
2. `.train`
3. `.ai`
4. `.history`
5. `.clear-h`
6. `.clear-h all`
7. `.generate`

Video generation is a desired future capability, not a requirement for the first stable release.

---

# 11. `.chatbot on/off`

This is the main automatic AI mode.

When enabled, NOVA_VOID should respond when it is explicitly addressed.

### Trigger A — WhatsApp mention

Example:

```text
Member: @NOVA_VOID hey hi
```

Expected concept:

```text
NOVA_VOID: Hey there 👋 How can I help you?
```

### Trigger B — WhatsApp reply/swipe

If a member replies/swipes to a message sent by NOVA_VOID, the bot should treat the message as an explicit chatbot trigger.

Example:

```text
Member: [replying to NOVA_VOID]
what did you mean?
```

NOVA_VOID responds.

### Non-trigger

```text
Member: hey everyone 😂
```

NOVA_VOID should remain silent when chatbot mode is enabled unless explicitly addressed.

### Important implementation rule

Do **not** implement the trigger as a naive text search for `@`.

Use WhatsApp/Baileys message metadata.

Relevant information includes:

- bot JID
- actual `mentionedJid` metadata
- quoted/replied participant
- normalized message context

The logical condition is:

```text
CHATBOT_ENABLED
AND
(
    DIRECT_MENTION(bot)
    OR
    REPLY_TO_BOT(bot)
)
```

The bot must also ignore its own outgoing messages to prevent loops.

---

# 12. CHATBOT STATE

Chatbot mode should be configurable per appropriate scope.

Possible scopes:

- global/private
- group

The final implementation must define the scope clearly rather than storing one ambiguous global boolean.

A group should be able to have chatbot mode independently of another group if group-scoped behavior is selected.

Owner/global settings must not accidentally override individual group configuration without explicit design.

---

# 13. `.ai`

`.ai` is the explicit one-off AI command.

Example:

```text
.ai explain how DNS works
```

Expected flow:

```text
command parser
→ permission/rate check
→ AI service
→ provider router
→ response
```

The command must not know provider-specific API details.

---

# 14. `.train`

`.train` means persistent bot knowledge/personality/memory.

It does **not** mean model fine-tuning.

The owner should be able to teach NOVA_VOID things such as:

- bot name
- creator/owner information
- personality
- preferred style
- facts
- custom knowledge
- instructions
- project-specific information

Possible command design:

```text
.train add <key> <value>
.train set <key> <value>
.train list
.train get <key>
.train remove <key>
```

The exact syntax can be simplified later.

The important architectural requirement is persistent storage and clear separation from conversation history.

---

# 15. TRAINING MEMORY IS NOT CHAT HISTORY

This distinction is mandatory.

### Training memory

Persistent knowledge/personality/instructions.

### Conversation history

Temporary contextual messages from an AI session.

Therefore:

```text
.clear-h
```

must not delete training memory.

---

# 16. `.history`

`.history` exposes the authorized user's current AI session/history.

The exact presentation can be:

- compact messages
- summary
- paginated output

The implementation should avoid flooding WhatsApp with a massive transcript.

The history command must enforce access rules.

---

# 17. `.clear-h`

Clears the current user's/session's AI conversation history.

It must not delete:

- training memory
- bot configuration
- user identity
- group settings

---

# 18. `.clear-h all`

Owner-only global AI-history deletion.

It clears conversation sessions across the bot's storage.

It must not erase:

- training memory
- configuration
- permissions
- user records
- group records

unless a future explicitly separate destructive command is designed for those purposes.

---

# 19. `.generate`

The owner wants image generation similar in concept to modern AI assistants.

Example:

```text
.generate a futuristic black spaceship above Lagos at night
```

The architecture must support image generation through a provider adapter.

The command must not be tied directly to one provider.

### Video generation

Video generation is desirable later.

Do not make video generation a dependency of the core bot.

Do not promise unlimited free video generation.

---

# 20. FREE AI / API POLICY

The owner has no money available for paid AI services and wants free solutions where possible.

This is a constraint, not a promise that every service will remain free.

Before selecting an AI provider, verify:

- current free tier
- current quota
- current rate limits
- authentication requirements
- model availability
- commercial-use terms
- image-generation availability
- geographic availability
- reliability

Never hard-code a provider because it was free at one point in time.

Never tell the owner that a free API is permanent without evidence.

---

# 21. AI PROVIDER ARCHITECTURE

Use a provider-neutral architecture.

Conceptual structure:

```text
src/ai/
├── provider.js
├── router.js
├── session-store.js
├── memory.js
├── chatbot.js
├── generation.js
└── prompts.js
```

### Provider

Defines the common interface.

### Router

Chooses providers and handles fallback.

### Session store

Stores conversation context.

### Memory

Stores persistent training knowledge.

### Chatbot

Determines whether chatbot mode should react.

### Generation

Abstracts image/video generation.

### Prompts

Combines system instructions, personality, training memory, and relevant history.

---

# 22. AI FALLBACK

The owner wants to avoid running out of limits.

The AI router should support multiple providers where legally and technically appropriate.

Conceptually:

```text
Provider A
   ↓ failure/limit
Provider B
   ↓ failure/limit
Provider C
```

However, fallback must not create uncontrolled repeated API requests.

Use:

- bounded retries
- provider cooldowns
- error classification
- rate-limit awareness
- request timeouts

A failed provider must never crash the entire bot.

---

# 23. AI TOKEN/DATA EFFICIENCY

The AI system should be deliberately economical.

Rules:

- Do not send unrelated group messages.
- Do not invoke AI for ordinary unaddressed messages.
- Limit conversation history length.
- Limit training-memory injection.
- Avoid duplicate requests.
- Apply cooldowns.
- Cache safe/static information when appropriate.
- Use provider fallback intelligently.
- Do not retry permanent errors.
- Keep prompts concise.

This protects both mobile data and API quotas.

---

# 24. AI SESSION ISOLATION

A conversation session must be scoped.

A user's private history must never appear in another user's response.

Group conversations should be scoped to the group and, if needed, participant/session policy.

The implementation should have a deterministic session key.

Example concept:

```text
private:<userJid>
group:<groupJid>:<userJid>
```

The final scope can differ, but it must be explicit and tested.

---

# 25. COMMAND COUNT TARGET

The owner requested roughly:

> **150–180 useful commands**

with an upper preference of approximately 200.

The number is a guideline, not a reason to add junk commands.

Every command must earn its place.

### Proposed distribution

| Category | Approximate target |
|---|---:|
| AI | 7–10 |
| Owner | 15 |
| Admin/moderation | 20–25 |
| Group | 20 |
| Downloader | 15–20 |
| Media | 10–15 |
| Utility | 15–20 |
| Search | 8–10 |
| Fun/games | 10–15 |
| Converter | 8–10 |
| System/help | 10 |

These are planning numbers, not hard requirements.

---

# 26. COMMAND AUDIT RULE

Every old command should be classified as exactly one of:

### KEEP

Useful, safe, maintainable, and worth preserving.

### REWRITE

Useful behavior but poor implementation.

### MERGE

Duplicates another command or can be consolidated.

### REMOVE

Broken, obsolete, unsafe, useless, redundant, or not worth maintaining.

### NEW

Required by NOVA_VOID but absent from the old repositories.

Do not port everything blindly.

---

# 27. COMMAND ENGINE

The command engine should be modular.

A command should declare things such as:

```text
name
aliases
category
description
usage
permissions
handler
```

The central command registry handles:

- registration
- duplicate detection
- aliases
- lookup
- help metadata
- execution routing

This prevents every command from reinventing the same logic.

---

# 28. MESSAGE PIPELINE

Target architecture:

```text
WhatsApp event
      ↓
transport adapter
      ↓
normalize message
      ↓
create message context
      ↓
security/permission context
      ↓
command detection
      ↓
chatbot trigger detection
      ↓
dispatcher
      ↓
command OR AI
      ↓
response
```

The old giant message handler should not be recreated.

---

# 29. MESSAGE NORMALIZATION

Every incoming WhatsApp message should become a consistent internal structure.

Minimum fields:

```text
id
chatJid
senderJid
botJid
text
mentionedJids
quotedParticipant
isGroup
isFromBot
timestamp
raw
```

The rest of the bot should depend on this normalized object rather than scattered Baileys-specific fields.

---

# 30. WHATSAPP TRIGGER LOGIC

The chatbot trigger must check:

1. Is chatbot mode enabled?
2. Is this a message from the bot itself?
3. Is the bot explicitly mentioned?
4. Is this a reply to the bot?
5. Is the sender allowed to use the chatbot in the current scope?
6. Is the request rate-limited?

Only then invoke the AI.

---

# 31. PERMISSION MODEL

Suggested hierarchy:

```text
OWNER
  ↓
SUDO / TRUSTED
  ↓
PREMIUM (future)
  ↓
ADMIN
  ↓
USER
```

The exact role names can be changed, but the principle is central authorization.

Dangerous commands must not rely on each command author remembering security rules independently.

Central checks should protect:

- shell/eval operations
- credential changes
- global history deletion
- bot shutdown
- plugin installation
- owner settings
- destructive storage operations

---

# 32. OWNER / SUDO / ADMIN

The system should distinguish:

### Owner

Full bot control.

### Sudo/trusted

Explicitly delegated high-level permissions.

### Admin

WhatsApp group moderation permissions.

### User

Normal commands permitted by policy.

Group admin status should not automatically equal bot owner status.

---

# 33. WHATSAPP CONNECTION

The connection layer should be isolated from application logic.

Target concept:

```text
WhatsAppConnection
├── connect()
├── reconnect()
├── logout()
├── pair()
└── events
```

Requirements:

- no duplicate connection loops
- controlled reconnect behavior
- safe authentication storage
- clear connection status
- no credentials committed to Git

---

# 34. STORAGE

The final storage model should separate:

```text
configuration
users
permissions
groups
chatbot state
AI sessions
training memory
cache
statistics
```

The physical storage implementation can be JSON, SQLite, another local database, or another appropriate store.

The choice should be based on:

- Termux compatibility
- reliability
- low dependency overhead
- corruption resistance
- concurrency needs
- backup simplicity

---

# 35. TRAINING MEMORY STORAGE

Training memory must be persistent.

It should support at minimum:

- add
- update
- list
- get
- remove

It should also be safe against malformed input.

Training data should have a clear ownership/scope policy.

Default assumption:

> Only the owner or explicitly authorized users can change global bot training memory.

---

# 36. CONVERSATION STORAGE

Conversation history should be bounded.

Recommended controls:

```text
MAX_MESSAGES_PER_SESSION
MAX_CHARS_PER_MESSAGE
MAX_TOTAL_CONTEXT
SESSION_TTL
```

Exact values should be configurable after provider testing.

Do not allow unlimited history by default.

---

# 37. STARTUP FLOW

Target startup:

```text
start
 ↓
load environment
 ↓
validate configuration
 ↓
initialize storage
 ↓
initialize permissions
 ↓
load commands
 ↓
initialize AI providers/router
 ↓
connect WhatsApp
 ↓
register events
 ↓
READY
```

If one optional subsystem fails, the bot should explain whether startup can continue safely.

---

# 38. DEPENDENCY STRATEGY

The old repository has a large dependency surface.

NOVA_VOID should be smaller.

Rules:

- Avoid duplicate WhatsApp libraries.
- Avoid duplicate media libraries.
- Remove unused packages.
- Prefer maintained packages.
- Avoid unnecessary native compilation on Termux.
- Add dependencies only when justified.

A dependency must have a reason to exist.

---

# 39. SECURITY RULES

Never commit:

- API keys
- WhatsApp session credentials
- private tokens
- passwords
- customer credentials

Use environment variables/secrets.

Example:

```text
.env
.env.example
```

`.env` must remain ignored.

`.env.example` contains placeholders only.

---

# 40. OLD SECURITY PROBLEMS NOT TO REPEAT

The old project contained patterns that must not be copied directly.

### Hard-coded credentials

Replace with environment/secrets.

### Dangerous shell/eval capability

Centralize and restrict.

### Updater

Do not copy the old updater architecture.

### Authentication files

Never commit WhatsApp session credentials.

### Obfuscated code

Do not introduce obfuscation into the new core unless there is a compelling, reviewed reason.

Readable source is important for maintenance and commercial auditing.

---

# 41. UPDATER PLAN

An updater is **not** an early priority.

When eventually implemented, it should be:

- versioned
- release-based
- predictable
- rollback-capable
- safe for user data
- safe for credentials
- compatible with customer deployments

Do not build an updater that blindly downloads and deletes arbitrary files.

---

# 42. COMMERCIALIZATION GOAL

The owner wants to sell the bot eventually.

That requires more than making commands work.

Before commercial release:

- audit dependencies
- audit licenses
- identify copied code
- preserve required attribution
- remove secrets
- document installation
- document configuration
- define versioning
- test clean installation
- protect user data
- create support/update procedures

Do not sell the project before these checks.

---

# 43. COMMERCIAL AI WARNING

AI provider free tiers may restrict commercial use.

Therefore, before selling a bot that uses a provider:

1. Check the provider's current terms.
2. Check API redistribution rules.
3. Check model licensing.
4. Check image/video generation rights.
5. Check whether the customer must provide their own key.
6. Check whether resale/white-label use is permitted.

Never assume a free API automatically grants commercial rights.

---

# 44. IMAGE GENERATION ARCHITECTURE

Use a provider interface.

Conceptually:

```js
await imageGenerator.generate({
  prompt,
  user,
  options,
});
```

The command should not contain provider-specific HTTP requests.

This allows providers to be changed without rewriting the command system.

---

# 45. VIDEO GENERATION ARCHITECTURE

Future interface:

```js
await videoGenerator.generate({
  prompt,
  user,
  options,
});
```

Video generation should remain optional.

The bot must still operate if no video provider is configured.

---

# 46. ERROR HANDLING

AI failures must not crash WhatsApp processing.

Provider errors should be classified where possible:

- authentication
- rate limit
- timeout
- temporary server error
- invalid request
- unavailable model
- unsupported feature

The router can retry/fallback only where appropriate.

---

# 47. LOGGING

Useful logs include:

- startup
- shutdown
- connection state
- command failures
- provider failures
- plugin failures
- security-sensitive operations

Avoid logging:

- API keys
- WhatsApp session credentials
- private AI histories by default
- unnecessary personal data

---

# 48. TESTING STRATEGY

Priority unit/integration tests:

### Message tests

- mention triggers
- reply triggers
- unrelated mention does not trigger
- ordinary group message does not trigger
- bot does not trigger itself

### Permission tests

- owner accepted
- sudo accepted
- admin accepted where appropriate
- normal user rejected from owner-only commands

### Session tests

- create session
- append message
- retrieve history
- clear one session
- clear all sessions
- isolation between users
- isolation between scopes

### Training tests

- add
- update
- list
- get
- remove
- persistence
- permission enforcement

### Provider tests

- register
- select
- fallback
- timeout
- no provider

### Command tests

- register
- aliases
- duplicates
- permissions
- unknown command

---

# 49. CURRENT VERIFIED REPOSITORY STATE

At the time this document was created, the `NOVA_VOID/` directory on `main` was verified to contain at least:

```text
NOVA_VOID/
├── .env.example
├── .gitignore
├── ARCHITECTURE.md
├── README.md
├── package.json
├── src/
├── test/
├── work.txt
└── PROJECT_MASTER.md
```

The source tree was also verified to contain these major areas:

```text
src/
├── ai/
├── commands/
├── config/
├── core/
└── index.js
```

The AI area currently includes files such as:

```text
ai-service.js
chatbot-service.js
chatbot.js
generation.js
memory-store.js
provider.js
router.js
session-store.js
```

The command area includes AI/chatbot/generation command modules.

The core includes command, message, permission, state, application, and factory modules.

### Important status rule

The existence of these files is verified.

**Their existence alone does not mean every feature is fully integrated or production-tested.**

The next developer/AI must inspect the actual source and run the available tests before reporting completion.

---

# 50. WHAT HAS BEEN DONE VS WHAT REMAINS

## VERIFIED / PRESENT IN REPOSITORY STRUCTURE

- NOVA_VOID directory exists.
- Environment example exists.
- Git ignore exists.
- README exists.
- Architecture document exists.
- Package manifest exists.
- AI subsystem exists.
- Command subsystem exists.
- Core subsystem exists.
- Tests directory exists.
- Master handoff exists.

## IMPLEMENTATION THAT MUST STILL BE VERIFIED END-TO-END

- WhatsApp connection boot
- command loading at runtime
- command dispatch at runtime
- `.chatbot on/off` end-to-end
- mention detection using real Baileys events
- reply/swipe detection using real Baileys events
- `.ai` against a real configured provider
- persistent `.train`
- `.history`
- `.clear-h`
- `.clear-h all` authorization
- `.generate` with an actual provider
- provider fallback
- session isolation
- production persistence
- clean Termux install

Do not mark these complete until tested.

---

# 51. WHAT MUST HAPPEN NEXT

The correct continuation order is:

## Phase 1 — Repository verification

Inspect every current NOVA_VOID source file.

Confirm imports and exports.

Confirm package scripts.

Confirm test setup.

Confirm entry point.

## Phase 2 — Runtime wiring

Make sure:

```text
WhatsApp event
→ normalize
→ context
→ permission
→ command/chatbot trigger
→ dispatcher
→ response
```

actually works.

## Phase 3 — AI persistence

Finish persistent training memory.

Keep it separate from session history.

## Phase 4 — AI commands

Make the seven core AI features genuinely end-to-end.

## Phase 5 — Provider research

Research current free/legitimate providers before selecting production providers.

## Phase 6 — Tests

Run/fix automated tests.

## Phase 7 — Old-command inventory

Audit the old repositories and classify commands.

## Phase 8 — Port valuable commands

Prioritize stable/high-value features.

## Phase 9 — Security review

Review secrets, permissions, shell/eval, downloads, updater, and storage.

## Phase 10 — Termux install

Create a minimal clean installation path.

## Phase 11 — Release preparation

README, configuration, versioning, license audit, installation testing.

## Phase 12 — Commercial readiness

Only after the core is stable and legally auditable.

---

# 52. COMMAND PORTING PRIORITY

Do not immediately port 180 commands.

First make the platform reliable.

### Tier 1 — Core

- help
- menu
- ping
- status
- runtime
- settings

### Tier 2 — AI

- chatbot
- ai
- train
- history
- clear-h
- generate

### Tier 3 — Administration

- group settings
- moderation
- permissions
- owner controls

### Tier 4 — High-value utility

- search
- downloader
- media
- converter
- utility

### Tier 5 — Fun/optional

Games, entertainment, miscellaneous commands.

---

# 53. COMMAND QUALITY RULE

Before adding a command, ask:

1. Is it useful?
2. Is it reliable?
3. Is it safe?
4. Is it duplicated?
5. Is the dependency reasonable?
6. Is the external service stable?
7. Is it legal/licensed for the intended use?
8. Does it work on Termux?
9. Does it increase maintenance cost too much?

If the answer is poor, remove or merge it.

---

# 54. AI PERSONALITY

NOVA_VOID should feel like a helpful WhatsApp assistant.

The owner wants responses such as:

```text
Hey there 👋
How can I help you?
```

But the exact personality should be configurable.

Do not hard-code the owner's preferred personality permanently into the source.

Training/configuration should be able to modify it.

---

# 55. GROUP BEHAVIOR

The bot should not become an annoying group participant.

Default behavior:

```text
normal conversation → silent
mention → respond
reply to bot → respond
explicit .ai → respond
```

This is one of the most important UX requirements.

---

# 56. PRIVACY POLICY AT ARCHITECTURE LEVEL

Conversation history is private data.

Therefore:

- scope it
- minimize it
- bound it
- avoid unnecessary logging
- do not expose it to other users
- make clearing reliable

Training memory is also controlled data.

Only authorized users should modify global training data.

---

# 57. RATE LIMITING

Rate limiting is required for:

- AI requests
- image generation
- video generation
- expensive download operations
- commands that call external APIs

Rate limits protect:

- API quotas
- mobile data
- bot stability
- abuse resistance

Do not use a single global limit if it unfairly blocks unrelated users.

Where appropriate use per-user/per-group limits.

---

# 58. CACHE STRATEGY

Safe cacheable data may include:

- command help metadata
- static configuration
- selected search results where appropriate
- provider capability information

Do not cache private AI output in a shared scope without an explicit privacy design.

---

# 59. OFFLINE / DEGRADED MODE

The bot should still be able to provide non-AI commands if AI providers are unavailable.

Example:

```text
AI unavailable
↓
commands still work
```

AI should be an important subsystem, not the single point of failure for the entire bot.

---

# 60. CONFIGURATION DESIGN

Configuration should be centralized and validated.

Examples:

```text
BOT_NAME
BOT_PREFIX
OWNER_JIDS
SUDO_JIDS
AI_PROVIDER
AI_MODEL
AI_TIMEOUT
AI_MAX_HISTORY
CHATBOT_DEFAULT
```

Actual names can change.

The important requirement is that configuration is not scattered throughout command files.

---

# 61. PREFIX / COMMAND PARSING

The bot should have a predictable command prefix.

The parser should produce a structure like:

```text
{
  command,
  args,
  rawText,
  prefix
}
```

It should handle:

- aliases
- whitespace
- empty commands
- unknown commands
- quoted arguments where needed

---

# 62. ERROR MESSAGES

User-facing errors should be short and useful.

Bad:

```text
TypeError: Cannot read properties of undefined...
```

Good:

```text
Something went wrong while processing that request.
Please try again.
```

Detailed stack traces belong in logs, not WhatsApp chat.

---

# 63. OBSERVABILITY

At minimum, the project should expose:

- uptime
- connection status
- command count
- loaded plugin count
- AI provider status
- recent error count

Sensitive data must not be exposed.

---

# 64. BACKUP STRATEGY

Before destructive migrations:

- back up configuration
- back up persistent training memory
- back up database/state
- preserve WhatsApp authentication separately

Never make migrations that silently delete customer data.

---

# 65. MIGRATIONS

If storage structure changes:

```text
old schema
→ migration
→ new schema
```

Do not simply delete old data because a new version expects a different format.

Migration scripts should be idempotent where practical.

---

# 66. LICENSE / ATTRIBUTION

Before commercial release:

- inspect repository licenses
- inspect dependency licenses
- identify copied code
- identify generated code
- preserve notices where required
- remove code whose license is incompatible with intended distribution

Do not assume public GitHub code is automatically free for resale.

---

# 67. README REQUIREMENTS

The final README should explain:

- what NOVA_VOID is
- features
- supported platforms
- Termux installation
- configuration
- pairing/login
- AI provider setup
- command categories
- security
- troubleshooting
- updating
- licensing
- contribution/development

Keep the README user-focused.

This master document remains the deeper developer handoff.

---

# 68. TERMUX INSTALLATION GOAL

Eventually a fresh Termux installation should require only the minimum necessary steps.

The final guide should avoid unnecessary PRoot/Debian layers unless a dependency absolutely requires them.

The target is something conceptually like:

```bash
pkg update
pkg install nodejs git
# clone repository
# install required npm dependencies
# configure .env
# start bot
```

The exact commands must be verified on the owner's actual Termux version before being published.

Do not tell the owner to run this exact sequence until the repository's dependency requirements have been checked.

---

# 69. CODING AGENT HANDOFF

If another AI is used in Termux, give it this file first.

Then tell it:

```text
Read NOVA_VOID/PROJECT_MASTER.md completely.
Inspect the actual repository.
Do not assume planned features are implemented.
Continue from CURRENT VERIFIED STATE.
Work in small safe batches.
Test before claiming completion.
Do not waste downloads.
Do not modify stable main blindly.
```

The agent should not ask the owner to repeat the project history.

---

# 70. FUTURE CODING-AGENT DECISION

The owner previously asked for a free coding AI better than OpenCode Zen.

Any future recommendation must account for:

- Android/Termux compatibility
- ARM64
- free availability
- API quotas
- mobile data usage
- installation size
- coding quality
- current support status

Research current conditions before recommending one.

Do not install several agents just to compare them.

---

# 71. RELEASE PHASES

## Alpha

Core architecture works.

## Beta

Core commands + AI + WhatsApp behavior work reliably.

## Release Candidate

Security, tests, installation, documentation, and dependency audits are complete.

## Production

Stable installation, update process, support process, licensing, and monitoring are ready.

## Commercial

Only after the licensing and provider terms have been checked.

---

# 72. RELEASE CHECKLIST

Before a production release:

- [ ] fresh Termux installation tested
- [ ] Node version supported
- [ ] dependencies install cleanly
- [ ] WhatsApp authentication works
- [ ] reconnect works
- [ ] commands load
- [ ] aliases work
- [ ] permissions work
- [ ] chatbot toggle works
- [ ] mention trigger works
- [ ] reply trigger works
- [ ] ordinary messages remain ignored
- [ ] `.ai` works
- [ ] `.train` works
- [ ] training persists
- [ ] `.history` works
- [ ] `.clear-h` works
- [ ] `.clear-h all` is owner-only
- [ ] `.generate` works when configured
- [ ] provider failure is handled
- [ ] session isolation tested
- [ ] no secrets committed
- [ ] license audit completed
- [ ] command inventory completed
- [ ] broken commands removed
- [ ] README complete
- [ ] versioning documented
- [ ] backup/migration strategy documented

---

# 73. DO NOT DO

Never:

- blindly copy the old bot
- copy the entire old architecture
- commit credentials
- commit WhatsApp session files
- let chatbot mode respond to every message
- expose private history
- delete training memory when clearing history
- promise permanent free AI APIs
- promise unlimited free image/video generation
- add commands just to increase the command count
- add unnecessary dependencies
- reinstall Debian/PRoot without need
- overwrite stable main with untested code
- claim tests were run if they were not
- claim a feature is end-to-end if only an interface exists
- waste the owner's mobile data
- make the owner repeat known requirements

---

# 74. SUCCESS CRITERIA

NOVA_VOID is successful when a user can:

1. Install it on a supported Termux environment.
2. Configure credentials safely.
3. Pair/login to WhatsApp.
4. Start the bot.
5. Use normal commands.
6. Enable chatbot mode.
7. Mention the bot and receive an AI response.
8. Reply/swipe to the bot and receive an AI response.
9. Talk normally in a group without causing unwanted AI responses.
10. Use `.ai` for explicit questions.
11. Train the bot with authorized commands.
12. Continue an AI conversation using scoped history.
13. View and clear history.
14. Generate images when a configured provider supports it.
15. Continue using non-AI commands if AI is unavailable.
16. Upgrade safely.

---

# 75. FINAL ARCHITECTURE

The intended end state is:

```text
                         WhatsApp
                            │
                            ▼
                   WhatsApp Transport
                            │
                            ▼
                  Message Normalizer
                            │
                            ▼
                    Message Context
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
       Command Parser                Chatbot Trigger
             │                             │
             ▼                             ▼
       Permission Layer              AI Session
             │                             │
             ▼                             ▼
       Command Handler               AI Router
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                         Provider A   Provider B   Provider C
                              │            │            │
                              └────────────┼────────────┘
                                           ▼
                                    AI Response
                                           │
                                           ▼
                                      WhatsApp
```

Persistent data sits underneath the application:

```text
                    NOVA_VOID
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
   Configuration   AI Sessions     Training Memory
        │               │                │
        ▼               ▼                ▼
     Users/Groups   Scoped History    Persistent Knowledge
```

---

# 76. FINAL DEVELOPMENT ORDER

The entire project should proceed in this order:

```text
1. Verify current repository
        ↓
2. Verify package/dependencies
        ↓
3. Verify WhatsApp connection
        ↓
4. Verify message normalization
        ↓
5. Verify command registry/dispatcher
        ↓
6. Verify permissions
        ↓
7. Verify chatbot triggers
        ↓
8. Finish AI sessions
        ↓
9. Finish persistent training memory
        ↓
10. Finish .ai
        ↓
11. Finish .chatbot
        ↓
12. Finish .history / .clear-h
        ↓
13. Finish .generate adapter
        ↓
14. Test everything
        ↓
15. Audit old commands
        ↓
16. Port high-value commands
        ↓
17. Security review
        ↓
18. Dependency/license review
        ↓
19. Termux clean-install test
        ↓
20. Documentation
        ↓
21. Release candidate
        ↓
22. Commercial readiness
```

Do not reverse this order merely to chase flashy features.

---

# 77. THE MOST IMPORTANT PRODUCT RULE

NOVA_VOID must not become a collection of copied snippets.

It should be a coherent product.

Every subsystem should have one clear responsibility.

Every external service should be replaceable.

Every privileged operation should have centralized authorization.

Every expensive operation should be rate-limited.

Every important feature should be testable.

Every credential should stay outside source control.

---

# 78. THE OWNER'S ORIGINAL AI DREAM — PRESERVED

The owner described the desired bot behavior roughly as:

```text
Member: @name hey hi

NOVA_VOID: hey there, how can I help you?
```

The bot should be able to help even when the owner is not personally online.

The user wants the bot to feel like an assistant rather than merely a command executor.

That is the heart of the NOVA_VOID AI feature.

---

# 79. WHAT “TRAIN” MEANS FOR THIS PROJECT

The word `train` should remain user-friendly, but technically it means:

> Store and retrieve controlled knowledge/personality/instructions that are injected into future AI prompts.

It does not mean:

- downloading a giant model
- locally fine-tuning an LLM
- spending huge amounts of data
- retraining neural-network weights

This distinction keeps the project lightweight and practical.

---

# 80. WHAT “HISTORY” MEANS FOR THIS PROJECT

History means contextual conversation memory.

It should be:

- bounded
- scoped
- clearable
- privacy-aware
- optional

It should not become an uncontrolled database of every WhatsApp message.

---

# 81. WHAT “AI” MEANS FOR THIS PROJECT

The AI system should be a service layer.

It should not control the whole bot.

The bot remains useful without AI.

AI is an enhancement.

This makes the product more resilient and makes provider changes easier.

---

# 82. WHAT “GENERATE” MEANS FOR THIS PROJECT

Generate is an external capability.

The bot asks a configured generation provider to produce media.

The bot should handle:

- prompt validation
- provider selection
- limits
- errors
- response delivery

The provider-specific details remain inside the provider adapter.

---

# 83. FUTURE PREMIUM FEATURES

Potential future premium capabilities:

- larger AI limits
- more providers
- image generation
- video generation
- advanced training memory
- custom personalities
- customer-specific branding
- advanced moderation
- analytics
- backup/restore

These are future ideas, not current commitments.

Do not build payment systems before the core is stable.

---

# 84. CUSTOMER SAFETY / DATA ISOLATION

If NOVA_VOID is eventually sold to multiple customers, each installation must have isolated:

- credentials
- WhatsApp sessions
- users
- groups
- AI history
- training memory
- configuration

Do not design the first version in a way that accidentally shares customer data between installations.

---

# 85. DOCUMENT MAINTENANCE

When a major architecture decision changes:

1. Update this document.
2. Update `ARCHITECTURE.md` if needed.
3. Update `README.md` if user installation changes.
4. Commit documentation with the corresponding code change.

Do not let the handoff document become stale.

---

# 86. STATUS LABELS FOR FUTURE WORK

Use these exact meanings:

### `PLANNED`

Not implemented.

### `IMPLEMENTED`

Code exists, but end-to-end verification may still be pending.

### `VERIFIED`

The feature has been tested at the relevant level.

### `PRODUCTION-READY`

Verified, documented, secured, and appropriate for release.

### `BLOCKED`

Cannot proceed without a dependency, provider, decision, or external condition.

---

# 87. HANDOFF INSTRUCTIONS TO A FUTURE AI

When asked to continue NOVA_VOID:

```text
1. Read this document.
2. Inspect main/current branch.
3. Inspect package.json.
4. Inspect source tree.
5. Inspect tests.
6. Check git status/branch state if available.
7. Determine the highest unfinished phase.
8. Implement a coherent batch.
9. Test it.
10. Fix failures.
11. Commit it.
12. Report only verified facts.
```

Do not start by rewriting the entire project.

Do not delete working code merely because a different architecture is prettier.

Refactor incrementally.

---

# 88. FIRST TASK AFTER HANDOFF

The first task for the next developer/AI is **not** to add another 20 commands.

It is:

> **Perform a complete integration audit of the current NOVA_VOID source tree and determine what actually runs from `index.js` through WhatsApp message handling.**

Specifically verify:

```text
index.js
 ↓
application/factory
 ↓
WhatsApp connection
 ↓
message normalization
 ↓
message context
 ↓
permissions
 ↓
command parser/registry
 ↓
chatbot trigger
 ↓
AI service/router
 ↓
response
```

Then fix the first broken link.

---

# 89. SECOND TASK

After the runtime path works:

> **Make the AI session/history system persistent and correctly scoped.**

Then test:

```text
User A → history A
User B → history B

A cannot see B.
B cannot see A.

A clears A.
B remains unchanged.

Owner clear-all clears all histories.
Training memory remains intact.
```

---

# 90. THIRD TASK

Then make these commands genuinely end-to-end:

```text
.chatbot on
.chatbot off
.ai
.train
.history
.clear-h
.clear-h all
.generate
```

No command should be called complete until its actual runtime path is verified.

---

# 91. FOURTH TASK

Research current AI providers only when the architecture is ready.

Because provider availability changes, perform fresh research at that point.

Select the provider strategy based on:

```text
free/affordable
+
quality
+
rate limits
+
Termux compatibility
+
commercial rights
+
reliability
```

Do not choose purely because a provider is popular.

---

# 92. FIFTH TASK

Audit the old repositories command-by-command.

Produce an inventory like:

| Command | Source | Category | Decision | Reason |
|---|---|---|---|---|
| example | old repo | utility | KEEP | stable/useful |
| example | old repo | AI | REWRITE | architecture outdated |
| example | both | media | MERGE | duplicate |
| example | old repo | unsafe | REMOVE | security |
| example | NOVA_VOID | AI | NEW | owner requirement |

This inventory should guide porting.

---

# 93. SIXTH TASK

Port high-value commands gradually.

After each category:

```text
port
→ lint/test
→ inspect
→ fix
→ commit
```

Do not port everything at once.

---

# 94. SEVENTH TASK

Run a security audit.

Search for:

```text
API keys
passwords
tokens
session files
child_process
exec
eval
Function(
dynamic downloads
arbitrary file deletion
unsafe URL fetching
```

Review every match manually.

---

# 95. EIGHTH TASK

Run dependency and license audits.

Check:

- direct dependencies
- transitive dependencies where relevant
- licenses
- abandoned packages
- native modules that complicate Termux
- duplicate libraries

---

# 96. NINTH TASK

Build the minimal Termux installation guide.

Test it on a clean environment before calling it final.

The owner must not be asked to reinstall large components without evidence they are needed.

---

# 97. TENTH TASK

Prepare the first release candidate.

Only after:

- core tests pass
- WhatsApp runtime works
- AI works with at least one supported provider
- chatbot triggers work correctly
- history isolation works
- training persistence works
- security review passes
- clean installation works

---

# 98. FINAL PROJECT DEFINITION

NOVA_VOID MDX is:

> **A clean, modular, Termux-friendly WhatsApp bot with roughly 150–180 genuinely useful commands and a compact AI assistant that responds when explicitly addressed, supports controlled training and conversation history, and can use replaceable AI/media providers.**

The bot should be reliable enough to use personally first.

Then it should be polished enough to distribute.

Then it can be evaluated for legitimate commercial sale.

---

# 99. FINAL PHILOSOPHY

```text
BUILD CLEAN.

KEEP IT LIGHT.

PROTECT THE USER.

PROTECT THE CREDENTIALS.

DON'T WASTE DATA.

DON'T CHASE COMMAND COUNT.

DON'T DEPEND ON ONE AI PROVIDER.

DON'T CLAIM WHAT HASN'T BEEN TESTED.

KEEP MAIN STABLE.

DOCUMENT THE WORK.

MAKE NOVA_VOID SOMETHING WORTH USING.
```

---

# 100. FINAL HANDOFF

This document exists so the project can continue even if:

- the owner changes coding agents
- Termux is reinstalled
- the chat conversation ends
- OpenCode is abandoned
- an AI provider changes
- the project is handed to another developer

The repository contains the code.

This document contains the plan and decisions.

`main` contains the stable project checkpoint.

Future work should continue from the **actual repository state**, not from assumptions.

---

## END OF MASTER PLAN

**NOVA_VOID MDX**

**Build it properly. One reliable layer at a time. ❤️**
