# AppForge Backup Strategy

Comprehensive backup and disaster recovery solution for AppForge.

## Overview

AppForge implements a robust backup strategy following the **3-2-1 rule**:
- **3 copies** of data (production + 2 backups)
- **2 different media** types (local disk + cloud storage)
- **1 off-site copy** (geographically separated)

## Backup Types

| Type | Frequency | Retention | Storage Location |
|------|-----------|-----------|------------------|
| Daily | Every day at 2 AM | 7 days | Local + Cloud |
| Weekly | Sunday | 4 weeks | Local + Cloud |
| Monthly | 1st of month | 12 months | Cloud (archival) |

## Quick Start

### Manual Backup

```bash
./scripts/backup-database.sh
# Or with docker-compose
docker-compose -f docker-compose.backup.yml run backup
```

### Restore from Backup

```bash
./scripts/backup-restore.sh backups/daily/latest.sql.gz
```

### Verify Backup

```bash
./scripts/backup-verify.sh
```

### Cleanup Old Backups

```bash
./scripts/backup-cleanup.sh
```

## Automated Backups

### Using Cron

```bash
crontab -e
0 2 * * * /path/to/scripts/backup-database.sh
0 3 * * 0 /path/to/scripts/backup-verify.sh
0 4 1 * * /path/to/scripts/backup-cleanup.sh
```

### Using Docker Compose

```bash
docker-compose -f docker-compose.yml -f docker-compose.backup.yml up -d backup-scheduler
```

## Cloud Storage

### AWS S3

```bash
export S3_BUCKET=your-bucket-name
export S3_REGION=us-east-1
export S3_ACCESS_KEY=your-access-key
export S3_SECRET_KEY=your-secret-key
./scripts/backup-database.sh
```

### Cloudflare R2

```bash
export S3_BUCKET=your-bucket-name
export S3_REGION=auto
export S3_ACCESS_KEY=your-access-key
export S3_SECRET_KEY=your-secret-key
./scripts/backup-database.sh
```

## Disaster Recovery

### Recovery Objectives

- **RTO (Recovery Time Objective):** < 4 hours
- **RPO (Recovery Point Objective):** < 24 hours

### Recovery Procedures

1. **Identify the issue** - Determine scope of data loss
2. **Select backup** - Choose appropriate backup based on RPO
3. **Verify backup** - Test backup integrity
4. **Restore database** - `./scripts/backup-restore.sh backups/daily/latest.sql.gz`
5. **Verify data** - Check data integrity
6. **Resume operations** - Bring application back online

## Best Practices

1. ✅ **Test restores regularly** - Verify backups can be restored
2. ✅ **Monitor backup jobs** - Set up alerts for failures
3. ✅ **Encrypt backups** - Protect sensitive data
4. ✅ **Store off-site** - Geographic redundancy
5. ✅ **Document procedures** - Clear recovery steps
6. ✅ **Review retention** - Adjust based on needs
7. ✅ **Automate everything** - Reduce human error

## Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [pg_dump Reference](https://www.postgresql.org/docs/current/app-pgdump.html)
- [AWS S3 Backup Guide](https://aws.amazon.com/s3/)

## Support

- 📧 Email: support@appforge.dev
- 💬 Discord: https://discord.gg/appforge
- 🐛 Issues: https://github.com/Anselm04/AppForge/issues
