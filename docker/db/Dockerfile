FROM alpine:3.20

# Instalar sqlite3, bash y utilitarios para respaldos
RUN apk add --no-cache \
    sqlite \
    bash \
    tzdata \
    coreutils

WORKDIR /data

COPY schema.sql /schema.sql
COPY database.db /initial_data/database.db
COPY docker/db/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Variables de entorno por defecto
ENV DB_FILE=/data/database.db \
    SCHEMA_FILE=/schema.sql \
    BACKUP_DIR=/backups \
    BACKUP_INTERVAL=21600

# Verificacion de salud nativa con SQLite
HEALTHCHECK --interval=10s --timeout=5s --start-period=3s --retries=3 \
  CMD sqlite3 /data/database.db "PRAGMA quick_check;" | grep -q "ok" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
