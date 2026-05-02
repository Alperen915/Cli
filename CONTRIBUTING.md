# Contributing to Arbitrum Agent Platform

Thank you for your interest in contributing to the Arbitrum Agent Platform CLI! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Issues

1. Check if the issue already exists in the GitHub Issues
2. If not, create a new issue with:
   - Clear title describing the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node.js version)

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Write/update tests if applicable
5. Ensure code follows existing style
6. Commit with clear messages: `git commit -m "feat: add new agent type"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

### Commit Message Format

We follow conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Maintenance tasks

## Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/arbitrum-agent-cli.git
cd arbitrum-agent-cli

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your OPENAI_API_KEY to .env

# Run the CLI
node index.js
```

## Project Structure

```
├── index.js                 # CLI entry point
├── src/
│   ├── agents/             # Agent implementations
│   ├── blockchain/         # Arbitrum blockchain integration
│   ├── commands/           # CLI command handlers
│   └── utils/              # Utilities and helpers
├── docs/                   # Documentation
└── tests/                  # Test files (coming soon)
```

## Adding New Agent Types

1. Create a new agent class in `src/agents/`
2. Extend `BaseAgent` class
3. Override `getSystemPrompt()` for specialized AI behavior
4. Register in `src/agents/agentManager.js`
5. Add configuration in `src/utils/config.js`

## Adding New Commands

1. Create command handler in `src/commands/`
2. Register command in `index.js`
3. Update documentation in `docs/COMMANDS.md`

## Security Guidelines

- Never commit API keys or secrets
- Use environment variables for sensitive data
- Never store private keys on disk
- Add security warnings for wallet operations

## Questions?

Open an issue with the `question` label or join our community discussions.
