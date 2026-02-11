#!/bin/bash

# deploy.sh - Script para despliegue remoto

SERVER_USER="usuario"
SERVER_HOST="servidor.com"
SERVER_PORT="2222"  # Cambia este puerto
SERVER_PATH="/home/usuario/app"
LOCAL_PATH="/Users/lucha/code/one-life-one-list"

echo "🚀 Iniciando despliegue a $SERVER_USER@$SERVER_HOST:$SERVER_PORT..."

# 1. Transferir archivos
echo "📦 Transferiendo archivos..."
rsync -avz -e "ssh -p $SERVER_PORT" --exclude='.git' --exclude='__pycache__' --exclude='node_modules' \
  --exclude='.DS_Store' --exclude='*.log' \
  $LOCAL_PATH/ $SERVER_USER@$SERVER_HOST:$SERVER_PATH/one-life-one-list/

# 2. Ejecutar comandos remotos
echo "🔧 Configurando servidor..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << EOF
cd $SERVER_PATH/one-life-one-list

# Detener servicios existentes
docker-compose down || true

# Construir y levantar servicios
docker-compose up -d --build

# Limpiar imágenes antiguas
docker image prune -f

# Mostrar estado
docker-compose ps
EOF

echo "✅ Despliegue completado!"
echo "🌐 Acceso: http://$SERVER_HOST"
