#!/bin/bash

# backup.sh - Script de backup para servidor remoto

SERVER_USER="usuario"
SERVER_HOST="servidor.com"
SERVER_PORT="2222"  # Cambia este puerto
BACKUP_DIR="/home/usuario/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="one-life-one-list-backend"

echo "🔄 Creando backup en servidor remoto..."

# Ejecutar backup en servidor remoto
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << EOF
# Crear directorio de backup
mkdir -p $BACKUP_DIR

# Exportar datos del contenedor
docker exec $CONTAINER_NAME tar -czf - /app/data > $BACKUP_DIR/data_$DATE.tar.gz

# Limpiar backups antiguos (mantener 7 días)
find $BACKUP_DIR -name "data_*.tar.gz" -mtime +7 -delete

echo "✅ Backup completado en servidor: data_$DATE.tar.gz"
EOF

# Opcional: Descargar backup a local
echo "📥 Descargando backup a local..."
mkdir -p ./backups
scp -P $SERVER_PORT $SERVER_USER@$SERVER_HOST:$BACKUP_DIR/data_$DATE.tar.gz ./backups/

echo "✅ Backup completado y descargado!"
