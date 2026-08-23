# Rate Limiting Middleware

Protects AppForge API from abuse and DDoS attacks.

## Quick Start

```typescript
import { rateLimiters, slowDownMiddleware } from './middleware';

// Apply global rate limiting
app.use(await rateLimiters.global());

// Stricter limits for auth routes
app.use('/api/auth', await rateLimiters.auth());

// Combine with slow down for defense in depth
app.use('/api', 
  await rateLimiters.api(),
  slowDownMiddleware.api()
);
```

## Rate Limit Tiers

| Tier | Window | Max Requests | Use Case |
|------|--------|--------------|----------|
| `anonymous` | 15 min | 50 | Unauthenticated users |
| `authenticated` | 15 min | 200 | Logged-in users |
| `premium` | 15 min | 500 | Premium subscribers |
| `enterprise` | 15 min | 1000 | Enterprise customers |
| `auth` | 15 min | 10 | Login/register endpoints |
| `api` | 15 min | 100 | General API endpoints |
| `build` | 1 hour | 20 | AI app generation |

## Headers

Responses include:
- `X-RateLimit-Limit` - Maximum requests
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset time (Unix timestamp)
- `Retry-After` - Seconds to wait (when limit exceeded)

## Redis Integration

```bash
export REDIS_URL=redis://localhost:6379
```

Automatically uses Redis if available for distributed rate limiting.

## Best Practices

1. ✅ Always use in production
2. ✅ Use Redis for multi-server deployments
3. ✅ Monitor rate limit hits
4. ✅ Different limits for different routes
5. ✅ Return clear error messages

See full documentation in src/middleware/ directory.
