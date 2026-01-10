FROM postgres:15-alpine

# Install required packages
RUN apk add --no-cache \
    bash \
    curl \
    aws-cli \
    redis \
    docker-cli \
    dcron \
    postgresql-client \
    gzip \
    tar \
    && rm -rf /var/cache/apk/*

# Copy backup scripts
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh

# Create cron job directory
RUN mkdir -p /etc/cron.d

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create backup directories
RUN mkdir -p /backups/postgres /backups/redis /backups/logs

ENTRYPOINT ["/entrypoint.sh"]
CMD ["crond", "-f", "-l", "2"]
