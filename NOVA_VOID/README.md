# NOVA_VOID MDX

A clean, modular WhatsApp bot built for Termux (Android, ARM64).

## Project goals

- Small, useful command set (target: ~150–180 commands)
- Event-driven WhatsApp core
- Mention/reply-triggered AI chatbot
- Persistent, bounded conversation history
- Owner-controlled training/memory
- Provider-agnostic AI layer
- Image generation with optional video-generation support
- Clear permissions and privacy boundaries
- Termux-friendly deployment

## Quick start (Termux)

```bash
cd NOVA_VOID
cp .env.example .env       # then edit OWNER_JIDS and PAIR_PHONE
npm install                # installs only baileys + pino
npm start
```

First run: the bot prints a pairing code — enter it in WhatsApp under
**Linked devices → Link with phone number**.

## Configuration

All configuration lives in `.env` (see `.env.example`). Never commit `.env`.

| Variable | Purpose |
|---|---|
| `BOT_NAME` | Display name (default `NOVA_VOID MDX`) |
| `PREFIX` | Command prefix (default `.`) |
| `OWNER_JIDS` | Comma-separated owner JIDs |
| `SUDO_JIDS` | Comma-separated trusted users |
| `PAIR_PHONE` | Phone number used once for pairing |
| `AUTH_DIR` / `DATA_DIR` | Storage locations (gitignored) |

## Commands

Core:

- `.ping` — liveness check
- `.menu` — command list by category
- `.status` — runtime status (owner/trusted)

AI:

- `.chatbot on|off` — per-chat chatbot toggle (owner)
- `.ai <prompt>` — one-off AI request; uses trained knowledge offline, honest error when neither provider nor knowledge matches
- `.train <info>` — owner-only persistent knowledge
- `.train-list` / `.train-remove <n>` — manage knowledge
- `.history` — view your AI session history (owner/trusted)
- `.clear-h` — clear your session history; `.clear-h all` is owner-only
- `.generate <prompt>` — image generation when a provider is configured

Chatbot triggers: direct @mention of the bot or a WhatsApp reply to a bot message. Ordinary messages are ignored.

Offline mode: without a connected AI provider, NOVA_VOID MDX still answers questions it can match against owner-trained knowledge (labeled "From my knowledge base"); anything else gets an honest "no provider" reply — never fake intelligence.

## Status

Implemented and unit-tested: command registry/dispatcher, permissions,
persistent chatbot state, persistent bounded history, training memory,
rate limiting, pairing flow, core + AI commands. Provider adapters are
not yet connected — `.ai`/`.generate` honestly report that no provider
is configured until you add real credentials.
