# AppForge 🚀

A **multi-agent app-building platform** that generates full-stack web applications using AI agents and integrates with **Stripe**, **GitHub**, **LLM APIs**, and **Cosine Genie 2**.

## Features

✨ **Multi-Agent Architecture**
- **Planning Agent**: Creates app architecture
- **Coding Agent**: Generates React & Node.js code
- **Reviewer Agent**: Reviews and improves code quality
- **Cosine Genie 2 Agent**: Automatically fixes bugs, adds features, optimizes performance

💳 **Monetization**
- Stripe integration for Pro subscriptions
- Free tier: 3 builds/month
- Pro tier: Unlimited builds + Cosine Genie 2 access

🔗 **Integrations**
- GitHub OAuth for code export
- Cosine Genie 2 for advanced code improvement
- Firebase/Supabase for authentication
- LLM API for AI-powered generation

🎨 **User Experience**
- Real-time progress streaming
- Dark mode support
- Mobile-responsive UI
- One-click GitHub export

## Tech Stack

**Backend**
- Node.js + Express
- tRPC for type-safe APIs
- PostgreSQL with Drizzle ORM
- Stripe webhooks
- GitHub OAuth

**Frontend**
- React + TypeScript
- Tailwind CSS
- Real-time SSE updates
- Dark mode toggle

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Stripe account
- GitHub OAuth app
- Cosine Genie 2 API key (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/Anselm04/AppForge.git
cd AppForge

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all required environment variables.

## Architecture

```
AppForge/
├── src/
│   ├── server.ts                 # Express app entry
│   ├── webhooks/
│   │   └── stripe.ts            # Stripe webhook handler
│   ├── auth/
│   │   ├── sdk.ts               # OAuth & session management
│   │   ├── env.ts               # Environment config
│   │   └── types/
│   │       └── manusTypes.ts     # OAuth types
│   ├── routers/
│   │   ├── projects.ts          # Project CRUD
│   │   ├── subscriptions.ts      # Stripe subscriptions
│   │   ├── github.ts            # GitHub integration
│   │   └── cosine.ts            # Cosine Genie 2 integration
│   ├── agents/
│   │   ├── pipeline.ts          # Multi-agent orchestration
│   │   └── types.ts             # Agent interfaces
│   ├── db.ts                    # Database queries
│   └── _core/
│       ├── trpc.ts              # tRPC setup
│       ├── router.ts            # Main tRPC router
│       └── llm.ts               # LLM helpers
├── public/
│   └── index.html
└── package.json
```

## API Endpoints

### tRPC Procedures

**Auth**
- `auth.me` - Get current user
- `auth.logout` - Clear session

**Projects**
- `projects.list` - List user's projects
- `projects.get` - Get single project
- `projects.create` - Create new project
- `projects.getLogs` - Get agent logs
- `projects.tierStatus` - Check free/pro limits

**Subscriptions**
- `subscriptions.status` - Check subscription status
- `subscriptions.createCheckout` - Create Stripe checkout
- `subscriptions.billingPortal` - Access Stripe portal

**GitHub**
- `github.connectionStatus` - Check GitHub connection
- `github.connectUrl` - Get OAuth URL
- `github.pushToRepo` - Export project to GitHub

**Cosine**
- `cosine.status` - Check Cosine integration status
- `cosine.improve` - Run Cosine Genie 2 improvements
- `cosine.prStatus` - Check PR status

### Webhooks

**Stripe** (`/api/webhooks/stripe`)
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`

## Agent Pipeline

The app uses a **3-agent pipeline** that generates code:

1. **Planner Agent** → Analyzes requirements, creates architecture
2. **Coder Agent** → Generates React components, Node.js routes, database schemas
3. **Reviewer Agent** → Reviews code, suggests improvements
4. **Cosine Genie 2 Agent** → Automatically improves code, fixes bugs, adds features (Pro tier)

Each agent streams output in real-time via Server-Sent Events (SSE).

## Tier System

### Free Tier
- 3 app generations/month
- Basic templates
- No GitHub export
- No dark mode
- No Cosine Genie 2

### Pro Tier ($29/month)
- Unlimited generations
- Advanced templates
- GitHub export enabled
- Dark mode enabled
- **Unlimited Cosine Genie 2 improvements**
- Priority support

## Cosine Genie 2 Integration

Pro users can click **"Improve with Cosine Genie 2"** to:
- Automatically fix bugs
- Add new features
- Optimize performance
- Improve code quality
- Update documentation
- Open PRs on GitHub for review

## Testing

```bash
# Run tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

## Deployment

### Vercel

```bash
vercel deploy
```

### Manual

```bash
npm run build
npm start
```

## Environment Requirements

- **Node.js**: 18+
- **PostgreSQL**: 12+
- **Port**: 3000 (configurable)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT

## Support

For issues or questions:
- GitHub Issues: [Create issue](https://github.com/Anselm04/AppForge/issues)
- Documentation: See `/docs`

---

**Built with ❤️ by Anselm04**