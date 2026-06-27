<!-- KING VOID_MDX | Premium WhatsApp Bot by King Val 👑 -->

<p align="center">
  <img src="https://i.imgur.com/dBaSKWF.gif" height="20" width="100%">
</p>

<div align="center">
  <h1>⚙️ KING VOID_MDX ⚙️</h1>
  <p><em>A Modular WhatsApp Bot Built for AI, Automation & Learning</em></p>
</div>

<img src="https://i.imgur.com/dBaSKWF.gif" height="20" width="100%">

<div align="center">

### ✦ Quick Links

[![WhatsApp Channel](https://img.shields.io/badge/WhatsApp%20Channel-Follow-25D366?style=for-the-badge&logo=whatsapp)](https://whatsapp.com/channel/0029VbC9Hv323n3dksPzCd0c)
[![WhatsApp Group](https://img.shields.io/badge/Support%20Group-Join-25D366?style=for-the-badge&logo=whatsapp)](https://chat.whatsapp.com/KTXT1NwXaMTHzJgICx7tlV?s=cl&p=a&mlu=3)
[![GitHub](https://img.shields.io/badge/GitHub-K--Void--mdx-181717?style=for-the-badge&logo=github)](https://github.com/K-Void-mdx/KING-VOID_MDX)

</div>

---

## 🤖 What is KING VOID_MDX?

**KING VOID_MDX** is a modern WhatsApp self-bot built on Node.js and Baileys. It's designed as a **learning platform** for beginners in JavaScript, AI, automation, and cybersecurity, while delivering real utility through plugins, AI integration, and group management tools.

Built and maintained by **King Val 👑** · Learning & Building 🔥

---

## 🚀 Why KING VOID_MDX?

This project was created as a **personal learning journey** — transforming and customizing an existing foundation into a completely original, self-hosted WhatsApp automation tool.

| ✦ | Feature | Description |
|---|---------|-------------|
| 📦 | **Plugin-Based Architecture** | Drop `.js` files to add commands — zero restarts, zero config |
| 🧠 | **Multi-AI Integration** | GPT, Gemini, DeepSeek, custom models |
| 🌐 | **Modular & Expandable** | Learn and extend with real-world code |
| 🛡️ | **Safe & Stable** | Self-bot architecture — no public API abuse |
| 👥 | **Full Group Control** | Moderation, automation, welcome messages |
| ⚡ | **Lightweight & Fast** | Optimized for Termux on mobile devices |
| 🔒 | **Private & Offline** | All sessions stored locally — no cloud sync |

---

## ⚙️ Core Features

<details>
<summary><b>🤖 AI & Automation</b></summary>

- ChatGPT, Gemini, DeepSeek integration
- Auto-reply with AI memory
- Image generation & editing
- Code assistant & documentation lookup

</details>

<details>
<summary><b>🖼️ Media Tools</b></summary>

- Sticker maker & converter
- Image effects (upscale, cartoon, remove BG)
- GIF & video processing
- OCR & image description

</details>

<details>
<summary><b>👥 Group Management</b></summary>

- Anti-spam, anti-link, anti-tag
- Welcome/goodbye messages
- Warn system with auto-kick
- Mute, kick, promote, demote
- Hidetag & poll creation

</details>

<details>
<summary><b>⬇️ Downloaders</b></summary>

- YouTube, TikTok, Instagram, Spotify
- Facebook, Pinterest, direct links
- APK downloader, Mediafire

</details>

<details>
<summary><b>🔧 Owner Controls</b></summary>

- AFK system with auto-disable
- Auto-read, anti-call, auto-react
- Sudo system (permission levels)
- Live reload — no restart needed
- Runtime variable control

</details>

---

## 📋 Requirements

- **Node.js** v20 or higher
- **npm** v8+
- A WhatsApp account (personal number)
- **Termux** or Linux environment (VPS optional)

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/K-Void-mdx/KING-VOID_MDX.git
cd KING-VOID_MDX

# 2. Install dependencies
npm install

# 3. Set up your environment
cp env.example .env
# Edit .env with your number, owner name, etc.

# 4. Start the bot
node index.js
```

On first run, you'll be asked for a **pairing code**. Link via WhatsApp:
> Settings → Linked Devices → Link a Device

---

## ⚙️ Configuration

Create a `.env` file:

```env
# Bot Identity
BOT_NAME=KING VOID_MDX
OWNER_NUMBER=2347046855205
OWNER_NAME=King Val 👑
PREFIX=.

# Features
PUBLIC_MODE=false
AUTO_READ=true
AUTO_REACT=true
ANTI_CALL=true

# AI (Optional)
AI_API_URL=https://your-ai-api.com/
GROQ_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
```

All settings can be changed at runtime using `.setvar KEY VALUE` — no restart needed!

---

## 📁 Project Structure

```
KING-VOID_MDX/
├── index.js                 ← Entry point
├── ⚉.js                     ← Main bot engine
├── ☁︎.js                     ← API server
├── settings/
│   └── config.js            ← Configuration
├── src/
│   ├── Commands/            ← Command modules (by category)
│   ├── Plugin/              ← Core handlers
│   └── database/            ← Runtime data (JSON)
├── library/
│   ├── serialize.js         ← Message serializer
│   ├── converter.js         ← Format converter
│   ├── connection/          ← Connection handlers
│   └── ...
└── database/                ← Sessions & persistent data
```

---

## ✦ Command Format

Create a new command in `src/Commands/<Category>/`:

```javascript
module.exports = {
    name: 'example',
    alias: ['ex'],
    desc: 'Example command',
    category: 'Tools',
    reactions: { start: '⚙️', success: '✅' },

    execute: async (sock, m, { args, reply }) => {
        await reply('Hello! 👋');
    }
};
```

Drop it in, run `.reload`, and it's live — no restarts!

---

## 🔐 Security & Privacy

- **Self-bot only** — runs on your WhatsApp account (no public API)
- **Local sessions** — credentials never leave your device
- **No cloud sync** — everything stays on your machine/server
- **Battle-tested** — months of production use

---

## 💡 For Beginners

This project is **perfect for learning**:

- Real-world Node.js patterns
- Baileys API & WhatsApp integration
- Plugin architecture & module design
- Git workflow & collaborative development
- Linux/Termux command line
- API integration & error handling

Start with simple commands, explore the codebase, modify & extend!

---

## 🤝 Contributing

Want to contribute?

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Commit: `git commit -m 'Add feature: description'`
5. Push: `git push origin feature/my-feature`
6. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with 🔥 by King Val 👑**

**KING VOID_MDX** — Learning, Building, Automating

*Made with ❤️ for the community*

© 2026 King Void MDX · All Rights Reserved

</div>
