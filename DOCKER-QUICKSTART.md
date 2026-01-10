# Docker Quick Start Guide

This guide will help you quickly get started with the enhanced Docker infrastructure including connection pooling, high availability, and automated backups.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available
- At least 20GB disk space

## Quick Start (5 Minutes)

### 1. Clone and Configure

```bash
# Copy environment file
cp .env.example .env

# Edit .env if needed (optional for development)
# nano .env
```

### 2. Create Required Directories

```bash
# Create backup directories
mkdir -p backups/postgres backups/redis backups/logs
```

### 3. Start All Services

```bash
# Using docker-compose
docker-compose up -d

# OR using the management script
chmod +x docker-manage.sh
./docker-manage.sh start
```

### 4. Verify Services

```bash
# Check all services are running
docker-compose ps

# Check health status
./docker-manage.sh health
```

### 5. Access Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **AI Service**: http://localhost:8000
- **PostgreSQL** (direct): localhost:5432
- **PgBouncer**: localhost:6432
- **Redis Master**: localhost:6379
- **PgAdmin** (dev): http://localhost:5050 (admin@example.com / admin)
- **Redis Commander** (dev): http://localhost:8082

## Infrastructure Overview

### Connection Pooling (PgBouncer)

**What it does**: Manages PostgreSQL connections efficiently
**Why you need it**: Prevents connection exhaustion, improves performance
**How to use**: Applications connect to port 6432 instead of 5432

```bash
# Check pool status
./docker-manage.sh pgbouncer pools
```

### High Availability (Redis Sentinel)

**What it does**: Automatic failover for Redis
**Why you need it**: Zero downtime for caching layer
**How it works**: 3 sentinels monitor master, auto-promote replica on failure

```bash
# Check Redis status
./docker-manage.sh redis sentinel
```

### Automated Backups

**What it does**: Scheduled backups with retention management
**Why you need it**: Disaster recovery and data protection
**Schedules**:
- PostgreSQL Full: Daily at 2 AM
- PostgreSQL Incremental: Every 6 hours
- Redis: Every 4 hours

```bash
# Manual backup
./docker-manage.sh backup postgres-full

# List backups
ls -lh backups/postgres/
```

## Common Operations

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
./docker-manage.sh logs backend
```

### Restart Services

```bash
# All services
./docker-manage.sh restart

# Single service
docker-compose restart backend
```

### Run Backups

```bash
# PostgreSQL full backup
./docker-manage.sh backup postgres-full

# PostgreSQL incremental backup
./docker-manage.sh backup postgres-incremental

# Redis backup
./docker-manage.sh backup redis
```

### Check Health

```bash
# Comprehensive health check
./docker-manage.sh health

# Check specific service
docker-compose exec postgres pg_isready
docker-compose exec redis-master redis-cli ping
```

### Access Database

```bash
# Via PgBouncer (recommended)
docker-compose exec pgbouncer psql -h localhost -p 6432 -U postgres -d psscript

# Direct PostgreSQL
docker-compose exec postgres psql -U postgres -d psscript

# Redis
docker-compose exec redis-master redis-cli
```

## Monitoring

### PgBouncer Statistics

```bash
# Connection pools
./docker-manage.sh pgbouncer pools

# Statistics
./docker-manage.sh pgbouncer stats

# Connected clients
./docker-manage.sh pgbouncer clients
```

### Redis Cluster Status

```bash
# Master info
./docker-manage.sh redis info

# Sentinel status
./docker-manage.sh redis sentinel

# Replica status
./docker-manage.sh redis replicas
```

### Backup Status

```bash
# View backup logs
tail -f backups/logs/backup.log

# View health logs
tail -f backups/logs/health.log

# List backups
ls -lh backups/postgres/
ls -lh backups/redis/
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker status
docker info

# Check logs
docker-compose logs

# Rebuild services
./docker-manage.sh rebuild
./docker-manage.sh start
```

### Connection Issues

```bash
# Verify network
docker network ls
docker network inspect psscript_psscript-network

# Check service health
./docker-manage.sh health

# Test connectivity
docker-compose exec backend ping postgres
docker-compose exec backend ping pgbouncer
docker-compose exec backend ping redis-master
```

### Backup Failures

```bash
# Check disk space
df -h

# Check backup logs
tail -100 backups/logs/backup.log

# Manual backup test
./docker-manage.sh backup postgres-full
```

### PgBouncer Issues

```bash
# Check PgBouncer logs
docker-compose logs pgbouncer

# Verify configuration
docker-compose exec pgbouncer cat /etc/pgbouncer/pgbouncer.ini

# Test direct PostgreSQL connection
docker-compose exec postgres psql -U postgres -d psscript -c "SELECT 1;"
```

### Redis Failover Not Working

```bash
# Check sentinel logs
docker-compose logs redis-sentinel-1

# Verify sentinel configuration
docker-compose exec redis-sentinel-1 redis-cli -p 26379 SENTINEL master mymaster

# Check replica status
docker-compose exec redis-master redis-cli INFO replication
```

## Testing Disaster Recovery

### Test PostgreSQL Restore

```bash
# Create test backup
./docker-manage.sh backup postgres-full

# List backups
./docker-manage.sh restore postgres

# Restore (this will ask for confirmation)
./docker-manage.sh restore postgres /backups/postgres/psscript_full_YYYYMMDD_HHMMSS.sql.gz
```

### Test Redis Failover

```bash
# Stop master
docker-compose stop redis-master

# Watch sentinel promote replica
docker-compose logs -f redis-sentinel-1

# Verify new master
./docker-manage.sh redis sentinel

# Restart original master (becomes replica)
docker-compose start redis-master
```

## Stopping Services

### Graceful Shutdown

```bash
# Stop all services (keeps data)
./docker-manage.sh stop

# OR
docker-compose down
```

### Complete Cleanup

```bash
# Remove containers and volumes (DELETES ALL DATA)
./docker-manage.sh clean

# OR
docker-compose down -v
```

## Production Deployment

### Before Going to Production

1. **Update passwords in .env**:
   - DB_PASSWORD
   - JWT_SECRET
   - REFRESH_TOKEN_SECRET

2. **Configure S3 backups** (add to .env):
   ```bash
   BACKUP_S3_BUCKET=your-production-bucket
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   ```

3. **Enable Redis password** (edit redis configs):
   - Uncomment `requirepass` in `/docker/redis/redis-master.conf`
   - Uncomment `masterauth` in `/docker/redis/redis-replica.conf`
   - Update backend REDIS_URL to include password

4. **Configure SSL/TLS**:
   - Set up PostgreSQL SSL certificates
   - Configure Redis TLS
   - Use HTTPS for frontend/backend

5. **Adjust resource limits**:
   - Edit `docker-compose.yml` to add resource limits
   - Increase pool sizes for high traffic
   - Adjust memory limits for Redis/PostgreSQL

6. **Set up monitoring**:
   - Configure external monitoring
   - Set up alerting for backup failures
   - Monitor disk space and performance

### Production docker-compose.yml Additions

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    restart: always
```

## Next Steps

1. **Read full documentation**: `docs/DOCKER-INFRASTRUCTURE.md`
2. **Review backup documentation**: `docker/backup/README.md`
3. **Test backup and restore procedures**
4. **Set up monitoring and alerting**
5. **Configure S3 for cloud backups**

## Management Script Reference

```bash
# Service management
./docker-manage.sh start        # Start all services
./docker-manage.sh stop         # Stop all services
./docker-manage.sh restart      # Restart all services
./docker-manage.sh status       # Show status

# Monitoring
./docker-manage.sh health       # Health check
./docker-manage.sh logs [svc]   # View logs

# Backups
./docker-manage.sh backup postgres-full
./docker-manage.sh backup redis
./docker-manage.sh restore postgres [file]

# PgBouncer
./docker-manage.sh pgbouncer pools
./docker-manage.sh pgbouncer stats

# Redis
./docker-manage.sh redis info
./docker-manage.sh redis sentinel

# Utilities
./docker-manage.sh shell backend
./docker-manage.sh rebuild
./docker-manage.sh clean

# Help
./docker-manage.sh help
```

## Support

- Full Documentation: `docs/DOCKER-INFRASTRUCTURE.md`
- Backup Guide: `docker/backup/README.md`
- Project Setup: `docs/DOCKER-SETUP.md`
- Getting Started: `docs/GETTING-STARTED.md`

## Useful Commands Cheat Sheet

```bash
# Start everything
./docker-manage.sh start

# Check if healthy
./docker-manage.sh health

# View backend logs
./docker-manage.sh logs backend

# Run backup
./docker-manage.sh backup postgres-full

# Check PgBouncer
./docker-manage.sh pgbouncer pools

# Check Redis
./docker-manage.sh redis sentinel

# Access PostgreSQL
docker-compose exec postgres psql -U postgres -d psscript

# Access Redis
docker-compose exec redis-master redis-cli

# Stop everything
./docker-manage.sh stop
```
