#!/bin/sh
# Database backup script for Railway PostgreSQL
# Run via cron or GitHub Actions

set -e

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${BACKUP_DATE}.sql"

echo "Creating database backup: $BACKUP_FILE"

# Requires DATABASE_URL environment variable
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

echo "Backup created: ${BACKUP_FILE}.gz"

# Optional: Upload to S3 (requires aws-cli)
# aws s3 cp ${BACKUP_FILE}.gz s3://your-bucket/ffxiv-backups/

# Optional: Clean up local file
# rm ${BACKUP_FILE}.gz
