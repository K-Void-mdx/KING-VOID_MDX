# NOVA_VOID MDX — Architecture Plan

## Core principles

1. Preserve the original repositories as historical references.
2. Build the production bot incrementally on `nova-void-rebuild`.
3. Keep AI providers behind one adapter/router interface.
4. Keep chatbot triggers explicit: direct mention or WhatsApp reply to the bot.
5. Keep AI history scoped to an authorized session.
6. Owner-only operations must be enforced by the core permission layer, not individual commands alone.
7. Prefer a smaller reliable command set over command-count inflation.
8. Audit licenses and third-party dependencies before commercial distribution.

## Planned layers

### Core
- WhatsApp connection lifecycle
- message normalization
- command parser/registry
- permissions
- group/user context
- event dispatch
- logging/error handling

### AI
- provider interface
- provider router/fallback
- chatbot trigger detection
- conversation/session manager
- memory/training store
- prompt/personality configuration
- image generation adapter
- optional video generation adapter

### Storage
- bot configuration
- user settings
- group settings
- AI sessions/history
- training/memory records

### Commands
Target approximately 150–180 useful commands after auditing the two legacy repositories. Do not port commands automatically; each command must be tested, deduplicated, and categorized.

## Chatbot trigger contract

With `.chatbot on`, a message may invoke the AI only when:

- the bot is directly mentioned, or
- the WhatsApp message is a reply to a message sent by the bot.

Messages that merely occur in the same group without either trigger should not invoke the chatbot.

## AI command contract

- `.chatbot on|off`
- `.train ...`
- `.ai <prompt>`
- `.history`
- `.clear-h`
- `.clear-h all` (owner only)
- `.generate <prompt>`

Provider credentials will be added later. No API keys belong in source control.
