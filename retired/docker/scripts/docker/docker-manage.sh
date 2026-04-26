#!/bin/bash

# Docker Infrastructure Management Script
# Provides convenient commands for managing the PSScript Docker infrastructure

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Command functions
cmd_start() {
    print_info "Starting all services..."
    docker-compose up -d
    print_success "All services started"
    cmd_status
}

cmd_stop() {
    print_info "Stopping all services..."
    docker-compose down
    print_success "All services stopped"
}

cmd_restart() {
    print_info "Restarting all services..."
    docker-compose restart
    print_success "All services restarted"
}

cmd_status() {
    print_info "Service Status:"
    docker-compose ps
}

cmd_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$service"
    fi
}

cmd_health() {
    print_info "Checking service health..."
    echo ""

    # Check PostgreSQL
    if docker-compose exec -T postgres pg_isready -U postgres &>/dev/null; then
        print_success "PostgreSQL is healthy"
    else
        print_error "PostgreSQL is unhealthy"
    fi

    # Check PgBouncer
    if docker-compose exec -T pgbouncer pg_isready -h localhost -p 6432 &>/dev/null; then
        print_success "PgBouncer is healthy"
    else
        print_error "PgBouncer is unhealthy"
    fi

    # Check Redis Master
    if docker-compose exec -T redis-master redis-cli ping &>/dev/null; then
        print_success "Redis Master is healthy"
    else
        print_error "Redis Master is unhealthy"
    fi

    # Check Redis Sentinels
    if docker-compose exec -T redis-sentinel-1 redis-cli -p 26379 ping &>/dev/null; then
        print_success "Redis Sentinel cluster is healthy"
    else
        print_error "Redis Sentinel cluster is unhealthy"
    fi

    # Run backup service health check
    docker-compose exec -T backup-service /scripts/health-check.sh 2>/dev/null || true
}

cmd_backup() {
    local type=$1

    if [ -z "$type" ]; then
        print_info "Usage: $0 backup [postgres-full|postgres-incremental|redis]"
        return 1
    fi

    case $type in
        postgres-full)
            print_info "Running PostgreSQL full backup..."
            docker-compose exec backup-service /scripts/postgres-backup.sh full
            print_success "PostgreSQL full backup completed"
            ;;
        postgres-incremental)
            print_info "Running PostgreSQL incremental backup..."
            docker-compose exec backup-service /scripts/postgres-backup.sh incremental
            print_success "PostgreSQL incremental backup completed"
            ;;
        redis)
            print_info "Running Redis backup..."
            docker-compose exec backup-service /scripts/redis-backup.sh
            print_success "Redis backup completed"
            ;;
        *)
            print_error "Unknown backup type: $type"
            return 1
            ;;
    esac
}

cmd_restore() {
    local type=$1
    local backup_file=$2

    if [ -z "$type" ]; then
        print_info "Usage: $0 restore [postgres|redis] [backup_file]"
        return 1
    fi

    case $type in
        postgres)
            if [ -z "$backup_file" ]; then
                print_info "Available PostgreSQL backups:"
                docker-compose exec backup-service ls -lh /backups/postgres/
                return 0
            fi
            print_warning "This will restore PostgreSQL from: $backup_file"
            read -p "Are you sure? (yes/no): " confirm
            if [ "$confirm" = "yes" ]; then
                docker-compose exec backup-service /scripts/restore-postgres.sh "$backup_file"
                print_success "PostgreSQL restore completed"
            else
                print_info "Restore cancelled"
            fi
            ;;
        redis)
            if [ -z "$backup_file" ]; then
                print_info "Available Redis backups:"
                docker-compose exec backup-service ls -lh /backups/redis/
                return 0
            fi
            print_warning "This will restore Redis from: $backup_file"
            read -p "Are you sure? (yes/no): " confirm
            if [ "$confirm" = "yes" ]; then
                docker-compose exec backup-service /scripts/restore-redis.sh "$backup_file"
                print_success "Redis restore completed"
            else
                print_info "Restore cancelled"
            fi
            ;;
        *)
            print_error "Unknown restore type: $type"
            return 1
            ;;
    esac
}

cmd_pgbouncer() {
    local action=$1

    case $action in
        pools)
            print_info "PgBouncer Pool Status:"
            docker-compose exec pgbouncer psql -h localhost -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS"
            ;;
        stats)
            print_info "PgBouncer Statistics:"
            docker-compose exec pgbouncer psql -h localhost -p 6432 -U postgres -d pgbouncer -c "SHOW STATS"
            ;;
        clients)
            print_info "PgBouncer Clients:"
            docker-compose exec pgbouncer psql -h localhost -p 6432 -U postgres -d pgbouncer -c "SHOW CLIENTS"
            ;;
        *)
            print_info "Usage: $0 pgbouncer [pools|stats|clients]"
            ;;
    esac
}

cmd_redis() {
    local action=$1

    case $action in
        info)
            print_info "Redis Master Info:"
            docker-compose exec redis-master redis-cli INFO replication
            ;;
        sentinel)
            print_info "Redis Sentinel Status:"
            docker-compose exec redis-sentinel-1 redis-cli -p 26379 SENTINEL master mymaster
            ;;
        replicas)
            print_info "Redis Replicas:"
            docker-compose exec redis-sentinel-1 redis-cli -p 26379 SENTINEL replicas mymaster
            ;;
        failover)
            print_warning "This will trigger a manual failover"
            read -p "Are you sure? (yes/no): " confirm
            if [ "$confirm" = "yes" ]; then
                docker-compose exec redis-sentinel-1 redis-cli -p 26379 SENTINEL failover mymaster
                print_success "Failover triggered"
            else
                print_info "Failover cancelled"
            fi
            ;;
        *)
            print_info "Usage: $0 redis [info|sentinel|replicas|failover]"
            ;;
    esac
}

cmd_clean() {
    print_warning "This will remove all containers, volumes, and data"
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
        print_info "Stopping services..."
        docker-compose down -v
        print_success "All containers and volumes removed"
    else
        print_info "Clean cancelled"
    fi
}

cmd_rebuild() {
    print_info "Rebuilding all services..."
    docker-compose build --no-cache
    print_success "Rebuild completed"
}

cmd_shell() {
    local service=$1

    if [ -z "$service" ]; then
        print_error "Usage: $0 shell [service_name]"
        print_info "Available services: frontend, backend, ai-service, postgres, redis-master, pgbouncer, backup-service"
        return 1
    fi

    docker-compose exec "$service" sh || docker-compose exec "$service" bash
}

cmd_help() {
    cat <<EOF
Docker Infrastructure Management Script

Usage: $0 [command] [options]

Commands:
  start                    - Start all services
  stop                     - Stop all services
  restart                  - Restart all services
  status                   - Show service status
  logs [service]           - Show logs (all or specific service)
  health                   - Check health of all services

  backup TYPE              - Run backup
    postgres-full          - Full PostgreSQL backup
    postgres-incremental   - Incremental PostgreSQL backup
    redis                  - Redis snapshot backup

  restore TYPE [file]      - Restore from backup
    postgres [file]        - Restore PostgreSQL (lists files if no file specified)
    redis [file]           - Restore Redis (lists files if no file specified)

  pgbouncer ACTION         - PgBouncer operations
    pools                  - Show connection pools
    stats                  - Show statistics
    clients                - Show connected clients

  redis ACTION             - Redis operations
    info                   - Show replication info
    sentinel               - Show sentinel status
    replicas               - Show replica status
    failover               - Trigger manual failover

  clean                    - Remove all containers and volumes
  rebuild                  - Rebuild all service images
  shell SERVICE            - Open shell in service container
  help                     - Show this help message

Examples:
  $0 start
  $0 backup postgres-full
  $0 restore postgres /backups/postgres/psscript_full_20260107_020000.sql.gz
  $0 pgbouncer pools
  $0 redis sentinel
  $0 logs backend
  $0 shell postgres

EOF
}

# Main command router
main() {
    local command=$1
    shift || true

    case $command in
        start)
            cmd_start "$@"
            ;;
        stop)
            cmd_stop "$@"
            ;;
        restart)
            cmd_restart "$@"
            ;;
        status)
            cmd_status "$@"
            ;;
        logs)
            cmd_logs "$@"
            ;;
        health)
            cmd_health "$@"
            ;;
        backup)
            cmd_backup "$@"
            ;;
        restore)
            cmd_restore "$@"
            ;;
        pgbouncer)
            cmd_pgbouncer "$@"
            ;;
        redis)
            cmd_redis "$@"
            ;;
        clean)
            cmd_clean "$@"
            ;;
        rebuild)
            cmd_rebuild "$@"
            ;;
        shell)
            cmd_shell "$@"
            ;;
        help|--help|-h|"")
            cmd_help
            ;;
        *)
            print_error "Unknown command: $command"
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
