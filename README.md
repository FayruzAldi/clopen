# Clopen

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-black)](https://bun.sh)

**Clopen** provides a modern web interface for AI-assisted development, supporting both **Claude Code** and **OpenCode** as AI engines. It runs as a standalone web application — manage multiple Claude Code accounts, use built-in git source control, preview your app in a real browser, edit files, collaborate in real-time, and never lose progress with git-like checkpoints.

---

## Features

- **Multi-Account Claude Code** - Manage multiple accounts (personal, work, team) and switch instantly per session, isolated under `~/.clopen/claude/user/` without touching system-level Claude config
- **Multi-Engine Support** - Switch between Claude Code and OpenCode
- **AI Chat Interface** - Streaming responses with tool use visualization
- **Background Processing** - Chat, terminal, and other processes continue running even when you close the browser — come back later and pick up where you left off
- **Git-like Checkpoints** - Multi-branch undo/redo system with file and folder snapshots
- **Real Browser Preview** - Puppeteer-based Chromium rendering with WebCodecs streaming (80-90% bandwidth reduction), full click/type/scroll/drag interaction
- **Integrated Terminal** - Multi-tab terminal with full PTY control
- **File Management** - Directory browsing, live editing, and real-time file watching
- **Git Management** - Full source control: staging, commits, branches, push/pull, stash, log, conflict resolution
- **Real-time Collaboration** - Multiple users can work on the same project simultaneously
- **Built-in Cloudflare Tunnel** - Expose local projects publicly for testing and sharing

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.2.12+
- [Claude Code](https://github.com/anthropics/claude-code) and/or [OpenCode](https://github.com/anomalyco/opencode) — required for AI chat functionality

### Installation

```bash
bun add -g @myrialabs/clopen
```

### Update

```bash
bun add -g @myrialabs/clopen
```

Same command as installation — Bun will update to the latest version.

### Usage

```bash
clopen
```

Starts the server on `http://localhost:9141`.

---

## Development

```bash
git clone https://github.com/myrialabs/clopen.git
cd clopen
bun install
bun run dev     # Start development server
bun run check   # Type checking
```

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Runtime | Bun.js |
| Frontend | Svelte 5 (runes) + Vite |
| Backend | Elysia + WebSocket |
| Styling | Tailwind CSS v4 |
| Database | SQLite with migrations |
| Terminal | bun-pty |
| AI Engines | Claude Code + OpenCode |

Clopen uses an engine-agnostic adapter pattern — both engines normalize output to Claude SDK message format, ensuring a consistent experience regardless of which engine is selected.

---

## Documentation

- [Technical Decisions](DECISIONS.md) - Architectural and technical decision log
- [Contributing](CONTRIBUTING.md) - How to contribute to this project
- [Development Guidelines](CLAUDE.md) - Guidelines for working with Claude Code on this project

---

## Troubleshooting

### Port 9141 Already in Use

```bash
clopen --port 9150
```

Or kill the existing process:
```bash
# Unix/Linux/macOS
lsof -ti:9141 | xargs kill -9

# Windows
netstat -ano | findstr :9141
taskkill /PID <PID> /F
```

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Claude Code](https://github.com/anthropics/claude-code) by Anthropic
- [OpenCode](https://opencode.ai) by Anomaly
- [Bun](https://bun.sh/) runtime
- [Svelte](https://svelte.dev/) framework

---

**Repository:** [github.com/myrialabs/clopen](https://github.com/myrialabs/clopen) · **Issues:** [Report a bug or request a feature](https://github.com/myrialabs/clopen/issues)
