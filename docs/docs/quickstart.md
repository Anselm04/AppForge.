---
sidebar_position: 2
---

# Quickstart

Get AppForge up and running in under 5 minutes.

## Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** or **yarn**
- **Git** ([Download](https://git-scm.com/))
- **Docker** (optional, for full setup)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Anselm04/AppForge.git
cd AppForge
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/appforge
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-here
NODE_ENV=development
PORT=3000
```

### 4. Set Up Database

```bash
docker-compose up -d
npm run db:push
npm run db:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

Your app will be available at [http://localhost:5173](http://localhost:5173)

## Verify Installation

Open your browser and navigate to `http://localhost:5173`. You should see the AppForge welcome page.

## Next Steps

### Create Your First Agent

```typescript
import { appforge } from './lib/appforge';

const agent = await appforge.agents.create({
  name: 'My First Agent',
  type: 'workflow',
  description: 'A simple agent to get started',
  config: { model: 'gpt-4', temperature: 0.7 },
});

console.log('Agent created:', agent.id);
```

### Create a Project

```typescript
const project = await appforge.projects.create({
  name: 'My Project',
  description: 'My first project',
  framework: 'react',
});

console.log('Project created:', project.id);
```

## Get Help

- 📖 Read the [Full Documentation](/docs/intro)
- 💬 Join our [Discord](https://discord.gg/appforge)
- 🐛 Report issues on [GitHub](https://github.com/Anselm04/AppForge/issues)

---

**Next:** [Installation Guide →](/docs/installation)
