# NOVA_VOID MDX

A clean rebuild of the KING VOID MDX WhatsApp bot.

## Project goals

- Small, useful command set (target: ~150–180 commands)
- Event-driven WhatsApp core
- Mention/reply-triggered AI chatbot
- Session-based AI conversation history
- Owner-controlled training/memory
- Provider-agnostic AI layer
- Image generation with optional video-generation support
- Clear permissions and privacy boundaries
- Termux-friendly deployment
- Commercial-product readiness, subject to dependency/license review

## AI commands

- `.chatbot on|off` — enable/disable mention/reply chatbot mode
- `.train` — owner-controlled bot knowledge/personality memory
- `.ai <prompt>` — one-off AI request
- `.history` — inspect the current authorized AI session
- `.clear-h` — clear the current session history
- `.clear-h all` — owner-only global history reset
- `.generate <prompt>` — image generation; video support will be provider-dependent

## Trigger behavior

When chatbot mode is enabled, NOVA_VOID responds when directly mentioned or when a message is a WhatsApp reply to the bot. Ordinary group messages are ignored unless another command explicitly handles them.

## Status

This branch is the clean rebuild workspace. Existing bot code remains untouched on `main` while the new architecture is developed here.
