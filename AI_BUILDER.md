# AppForge AI Builder

Build complete applications from natural language descriptions.

## Quick Start

### 1. Start the AI Builder

```bash
npm run dev
# Navigate to /ai-builder
```

### 2. Describe Your App

Type your app idea in plain English:

```
"I want a task management app with:
- User authentication
- Create, edit, delete tasks
- Assign tasks to team members
- Due dates and reminders
- Progress tracking
- Dashboard with analytics"
```

### 3. Watch It Build

The AI will:
1. Extract requirements
2. Ask clarification questions
3. Generate complete app
4. Show live preview
5. Ready to deploy

## Features

### Chat-Based Interface
- Natural language input
- Real-time conversation
- Clarification questions
- Iterative refinement

### Live Preview
- See app being built in real-time
- Interactive preview
- Test functionality
- Instant feedback

### One-Click Deploy
- Deploy to Vercel
- Export to GitHub
- Download source code
- Production-ready

## API Endpoints

### POST /api/ai/extract

Extract requirements from user prompt.

```json
{
  "prompt": "I want a task management app"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "appName": "Task Manager",
    "description": "A task management application",
    "features": ["authentication", "crud", "dashboard"],
    "targetAudience": "Teams and individuals",
    "technicalRequirements": ["react", "express", "postgresql"],
    "integrations": [],
    "dataModels": ["User", "Task"],
    "userRoles": ["user", "admin"]
  }
}
```

### POST /api/ai/clarify

Generate clarification questions.

```json
{
  "requirements": {
    "appName": "Task Manager"
  }
}
```

### POST /api/ai/generate

Generate complete app from requirements.

```json
{
  "requirements": {
    "appName": "Task Manager",
    "features": ["authentication", "crud"]
  }
}
```

### POST /api/ai/iterate

Iterate on existing app.

```json
{
  "appId": "app_123",
  "changes": "Add dark mode support"
}
```

### POST /api/ai/deploy/:appId

Deploy app to Vercel.

```json
{}
```

### POST /api/ai/export/:appId

Export app to GitHub.

```json
{
  "repoName": "my-task-app"
}
```

## Configuration

### Environment Variables

```bash
# AI Configuration
OPENAI_API_KEY=your-openai-api-key
AI_MODEL=gpt-4-turbo

# Deployment
VERCEL_API_KEY=your-vercel-api-key
GITHUB_TOKEN=your-github-token
```

## Examples

### Example 1: Task Management App

```
"Build a task management app for my team. We need to create tasks, assign them to team members, set due dates, and track progress. I also want a dashboard showing completed tasks and analytics."
```

### Example 2: E-commerce Store

```
"I need an e-commerce store to sell handmade jewelry. It should have product listings, shopping cart, checkout with Stripe, user accounts, and order tracking."
```

### Example 3: CRM System

```
"Create a CRM to manage customer relationships. Track customer contacts, log interactions, manage sales pipeline, and generate monthly reports."
```

### Example 4: Fitness App

```
"Build a fitness tracking app where users can log workouts, track progress over time, set goals, and share achievements with friends."
```

## Best Practices

1. **Be Specific** - The more details you provide, the better the app
2. **Answer Questions** - Respond to clarification questions for best results
3. **Iterate** - Refine your app through conversation
4. **Test** - Always test the generated app before deploying
5. **Customize** - Download source code for further customization

## Troubleshooting

### App doesn't match description
- Provide more specific details
- Answer all clarification questions
- Use iterative refinement

### Deployment fails
- Check environment variables
- Verify Vercel account
- Check build logs

### Code errors
- Download source code
- Review generated code
- Make manual fixes as needed

## Resources

- [OpenAI API](https://platform.openai.com/)
- [Vercel Deployment](https://vercel.com/docs)
- [GitHub API](https://docs.github.com/)

## Support

- 📧 Email: support@appforge.dev
- 💬 Discord: https://discord.gg/appforge
- 🐛 Issues: https://github.com/Anselm04/AppForge/issues
