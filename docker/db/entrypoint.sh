#!/bin/bash
set -e

DB_FILE="${DB_FILE:-/data/database.db}"
SCHEMA_FILE="${SCHEMA_FILE:-/schema.sql}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL="${BACKUP_INTERVAL:-21600}" # Por defecto cada 6 horas

mkdir -p "$(dirname "$DB_FILE")"
mkdir -p "$BACKUP_DIR"

term_handler() {
    echo "[DB SERVICE] Deteniendo servicio de base de datos de manera limpia..."
    exit 0
}

trap 'term_handler' SIGTERM SIGINT

echo "==================================================="
echo " [DB SERVICE] Gestor de Base de Datos SQLite Activo"
echo " Archivo de base de datos: $DB_FILE"
echo "==================================================="

# Si el archivo de base de datos no existe, inicializarlo con el esquema
if [ ! -f "$DB_FILE" ] || [ ! -s "$DB_FILE" ]; then
    echo "[DB SERVICE] No se encontro base de datos previa. Inicializando desde $SCHEMA_FILE..."
    if [ -f "$SCHEMA_FILE" ]; then
        sqlite3 "$DB_FILE" < "$SCHEMA_FILE"
        chmod 666 "$DB_FILE"
        echo "[DB SERVICE] Esquema inicial cargado exitosamente."
    else
        echo "[DB SERVICE] Advertencia: No se encontro $SCHEMA_FILE. Creando base vacia."
        sqlite3 "$DB_FILE" "VACUUM;"
        chmod 666 "$DB_FILE"
    fi
else
    echo "[DB SERVICE] Base de datos existente detectada. Verificando integridad..."
    CHECK=$(sqlite3 "$DB_FILE" "PRAGMA quick_check;")
    if [ "$CHECK" = "ok" ]; then
        echo "[DB SERVICE] Integridad de base de datos: OK"
    else
        echo "[DB SERVICE] Advertencia en comprobacion de integridad: $CHECK"
    fi
    chmod 666 "$DB_FILE"
fi

# Respaldo inicial al iniciar
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).db"
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'" 2>/dev/null || true
echo "[DB SERVICE] Respaldo inicial generado en $BACKUP_FILE"

# Bucle de mantenimiento, verificacion de salud y respaldos periodicos
LAST_BACKUP=$(date +%s)

while true; do
    sleep 30 &
    wait $!

    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - LAST_BACKUP))

    if [ "$ELAPSED" -ge "$BACKUP_INTERVAL" ]; then
        BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).db"
        echo "[DB SERVICE] Ejecutando respaldo programado en $BACKUP_FILE..."
        if sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"; then
            echo "[DB SERVICE] Respaldo completado con exito."
            LAST_BACKUP=$CURRENT_TIME
            # Mantener unicamente los ultimos 10 respaldos para ahorrar espacio
            ls -t "$BACKUP_DIR"/backup_*.db 2>/dev/null | tail -n +11 | xargs -r rm --
        else
            echo "[DB SERVICE] Error al generar el respaldo programado."
        fi
    fi
done
