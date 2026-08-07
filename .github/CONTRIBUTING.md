# Contributing to AppForge

Thank you for your interest in contributing to AppForge! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js 20+ installed
- npm or pnpm package manager
- Git
- A GitHub account

### Setup

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/AppForge.git
   cd AppForge
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

5. **Run the development server**:
   ```bash
   npm run dev
   ```

## Development Workflow

### 1. Create a Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

**Branch naming conventions:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

### 2. Make Changes

- Follow the existing code style
- Write meaningful commit messages
- Keep commits focused and atomic
- Add/update tests as needed

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run type checking
npx tsc --noEmit

# Run linting
npm run lint

# Build the project
npm run build
```

### 4. Commit Your Changes

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: add multi-agent pipeline orchestration
fix: resolve race condition in agent communication
docs: update README with setup instructions
refactor: simplify database connection logic
test: add unit tests for pipeline.ts
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a PR on GitHub with:
- Clear description of changes
- Reference to related issues
- Screenshots if UI changes
- Test instructions

## Code Quality

### Linting

We use ESLint and Prettier:

```bash
npm run lint
npm run format
```

### Testing

All PRs must pass existing tests and ideally add new tests:

```bash
npm test -- --coverage
```

### Type Safety

TypeScript is strictly enforced:

```bash
npx tsc --noEmit
```

## What to Work On

### Good First Issues

Look for issues labeled:
- `good first issue`
- `help wanted`
- `documentation`

### Feature Ideas

- Improve agent performance
- Add new agent types
- Enhance UI/UX
- Add integrations (GitHub, Vercel, etc.)
- Improve error handling
- Add documentation

## Security

- Never commit secrets or API keys
- Report security issues privately
- Use environment variables for sensitive data

## Questions?

Open an issue or reach out to the maintainers. We're happy to help!

---

**Thank you for contributing to AppForge! 🚀**
