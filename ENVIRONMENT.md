# AppForge Environment Variables

## Required Variables

### Database

```bash
DATABASE_URL=postgresql://user:password@host:5432/database_name
```

- **Format**: PostgreSQL connection string
- **Example**: `postgresql://appforge:secret@localhost:5432/appforge`
- **Source**: Your PostgreSQL instance (local, Docker, or cloud)

### Authentication

```bash
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
```

- **Format**: Random string (min 32 characters)
- **Generate**: `openssl rand -base64 32`
- **Purpose**: Signing JWT tokens for authentication

### API Keys

```bash
# Vercel (for deployment automation)
VERCEL_TOKEN=your-vercel-token

# GitHub (for CI/CD)
GITHUB_TOKEN=your-github-token
```

## Optional Variables

### Feature Flags

```bash
ENABLE_ANALYTICS=true
ENABLE_MONITORING=true
ENABLE_BACKUPS=true
```

### External Services

```bash
# Email (if using)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password

# Storage (if using)
S3_BUCKET=appforge-assets
S3_REGION=us-east-1
S3_ACCESS_KEY=access-key
S3_SECRET_KEY=secret-key
```

### Monitoring

```bash
# Sentry (error tracking)
SENTRY_DSN=https://key@sentry.io/project-id

# Prometheus (metrics)
PROMETHEUS_URL=http://prometheus:9090
```

## Environment-Specific

### Development (.env.local)

```bash
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/appforge_dev
JWT_SECRET=dev-secret-key-change-in-production
```

### Testing (.env.test)

```bash
NODE_ENV=test
DATABASE_URL=postgresql://localhost:5432/appforge_test
JWT_SECRET=test-secret-key
```

### Production (.env.production)

```bash
NODE_ENV=production
DATABASE_URL=postgresql://prod-db:5432/appforge_prod
JWT_SECRET=<strong-random-secret>
```

## Vercel Environment Variables

Set these in Vercel dashboard:

1. Go to project settings → Environment Variables
2. Add each variable for production/preview/development
3. Deploy after adding variables

### Required for Vercel

```bash
DATABASE_URL
JWT_SECRET
NODE_ENV
```

### Optional for Vercel

```bash
ENABLE_ANALYTICS
SENTRY_DSN
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
```

## Security Best Practices

1. **Never commit .env files**: Already in `.gitignore`
2. **Use strong secrets**: Min 32 chars for JWT_SECRET
3. **Rotate secrets regularly**: Especially after team changes
4. **Use environment-specific values**: Different DB per environment
5. **Limit access**: Only necessary team members should have production secrets
6. **Use secret managers**: Consider 1Password, AWS Secrets Manager, etc.

## Validation

The application validates environment variables on startup:

```typescript
// src/config/index.ts
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
```

If the app fails to start, check:

1. All required variables are set
2. No typos in variable names
3. Values are properly formatted
4. Database is accessible

## Troubleshooting

### "DATABASE_URL is required"

- Copy `.env.example` to `.env`
- Fill in your database URL
- Restart the application

### "JWT_SECRET is too short"

- Generate a longer secret: `openssl rand -base64 48`
- Update `.env` file
- Restart the application

### "Cannot connect to database"

- Verify DATABASE_URL format
- Check database is running
- Ensure network access (firewall, Docker networking)
- Test connection: `psql $DATABASE_URL`

## Tools

### Generate secrets

```bash
# JWT secret
openssl rand -base64 48

# Generic secret
openssl rand -hex 32
```

### Validate .env

```bash
# Check file exists
ls -la .env

# Check variables
cat .env | grep -E '^[A-Z]+'
```

### Load environment

```bash
# In development
npm run dev

# In production
NODE_ENV=production npm run start
```

## Migration

When moving from development to production:

1. Copy `.env.example` to `.env.production`
2. Generate production-grade secrets
3. Set up production database
4. Update DATABASE_URL
5. Test thoroughly before deploying

## Backup

Always backup your `.env` files securely:

```bash
# Encrypted backup
tar -czf env-backup.tar.gz .env* | openssl enc -aes-256-cbc -salt -out env-backup.enc

# Store in secure location (not in git!)
```

Restore when needed:

```bash
openssl enc -aes-256-cbc -d -in env-backup.enc | tar -xzf -
```

## Compliance

- Secrets encrypted at rest
- Access logged and audited
- Rotated on schedule (quarterly recommended)
- Stored in approved secret managers
- Never logged or exposed in error messages
