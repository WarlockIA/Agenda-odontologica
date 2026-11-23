FROM node:20-bookworm-slim

# Instalar curl para el healthcheck del contenedor
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias de produccion
RUN npm ci --omit=dev

# Copiar codigo fuente y artefactos requeridos
COPY src/ ./src/
COPY schema.sql ./schema.sql
COPY Proyecto_Ciencia_de_Datos/modelos/regresion_logistica_node.json ./Proyecto_Ciencia_de_Datos/modelos/regresion_logistica_node.json
COPY public/ ./public/
COPY scripts/ ./scripts/

# Crear directorios para persistencia de datos SQLite y archivos adjuntos
RUN mkdir -p /app/data /app/uploads

# Variables de entorno por defecto para el backend
ENV NODE_ENV=production \
    IS_DOCKER=true \
    HOST=0.0.0.0 \
    PORT=3000 \
    TRUST_PROXY=true \
    DB_PATH=/app/data/database.db \
    UPLOAD_PATH=/app/uploads

EXPOSE 3000

# Verificacion de estado de salud del servicio
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "src/server.js"]
