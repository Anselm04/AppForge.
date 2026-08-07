---
sidebar_position: 1
---

# API Overview

AppForge provides a RESTful API for managing agents, projects, and tasks.

## Base URL

```
https://api.appforge.dev
```

## Authentication

All API requests require authentication using JWT tokens.

```bash
Authorization: Bearer <your-token>
```

## Response Format

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Example",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

## Error Responses

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

## Rate Limiting

- **100 requests/minute** for authenticated users
- **20 requests/minute** for unauthenticated requests

## Endpoints

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/agents/:id` | Get agent |
| PUT | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Delete agent |
| POST | `/api/agents/:id/run` | Run agent |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

## SDK

```bash
npm install @appforge/sdk
```

```typescript
import { AppForge } from '@appforge/sdk';
const appforge = new AppForge({ apiKey: 'your-api-key' });
const agents = await appforge.agents.list();
```

## Next Steps

- [Authentication](/docs/api/authentication)
- [Agents API](/docs/api/agents/list)
- [Projects API](/docs/api/projects/list)
- [Tasks API](/docs/api/tasks/list)
