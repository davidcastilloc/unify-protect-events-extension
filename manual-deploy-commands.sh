#!/bin/bash

# Comandos manuales para desplegar UniFi Protect Notifications
# Ejecuta estos comandos uno por uno en tu terminal

SERVER="10.0.0.108"
USER="root"
PASSWORD="100*PuertoPiritu"
DEPLOY_DIR="/opt/unifi-protect-notifications"

echo "🚀 Comandos para desplegar manualmente en $SERVER"
echo "=================================================="
echo ""

echo "1. Conectar al servidor:"
echo "ssh $USER@$SERVER"
echo ""

echo "2. Instalar dependencias (ejecutar en el servidor):"
echo "dnf update -y"
echo "dnf install -y dnf-plugins-core"
echo "dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo"
echo "dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
echo "systemctl enable docker"
echo "systemctl start docker"
echo ""

echo "3. Crear directorio de despliegue:"
echo "mkdir -p $DEPLOY_DIR"
echo "cd $DEPLOY_DIR"
echo ""

echo "4. Crear archivo .env (ejecutar en el servidor):"
cat << 'ENVEOF'
cat > .env << 'EOF'
# Configuración del servidor de producción
PORT=3001
NODE_ENV=production

# Configuración UniFi Protect - ACTUALIZAR ESTOS VALORES
UNIFI_HOST=192.168.1.100
UNIFI_PORT=443
UNIFI_API_KEY=tu_api_key_aqui
UNIFI_SSL_VERIFY=false

# Configuración de seguridad
JWT_SECRET=tu_jwt_secret_muy_seguro_para_produccion_$(date +%s)
CORS_ORIGIN=http://10.0.0.108:3001

# Configuración de logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Configuración de conexión
UNIFI_REAL_CONNECTION=true

# Configuración de Redis
REDIS_PASSWORD=redis_password_seguro_$(date +%s)

# Configuración de WebSocket
WS_HANDSHAKE_TIMEOUT=10000
WS_PING_INTERVAL=30000
WS_CONNECTION_TIMEOUT=90000
WS_MAX_RECONNECT_ATTEMPTS=5
WS_RECONNECT_DELAY=5000
WS_MAX_RECONNECT_DELAY=30000

# Configuración de UniFi Protect WebSocket
UNIFI_WS_HANDSHAKE_TIMEOUT=15000
UNIFI_WS_RECONNECT_DELAY=10000
EOF
ENVEOF
echo ""

echo "5. Crear directorios necesarios:"
echo "mkdir -p logs data"
echo ""

echo "6. Copiar docker-compose.yml (desde tu máquina local):"
echo "scp docker-compose.vps.yml $USER@$SERVER:$DEPLOY_DIR/docker-compose.yml"
echo ""

echo "7. Desplegar la aplicación (ejecutar en el servidor):"
echo "cd $DEPLOY_DIR"
echo "docker-compose pull"
echo "docker-compose up -d"
echo ""

echo "8. Verificar el despliegue:"
echo "docker-compose ps"
echo "curl http://localhost:3001/health"
echo ""

echo "9. Ver logs si hay problemas:"
echo "docker-compose logs -f"
echo ""

echo "=================================================="
echo "🎉 Una vez completado, la aplicación estará disponible en:"
echo "📍 http://10.0.0.108:3001"
echo ""
echo "⚠️ IMPORTANTE: Actualiza las variables de entorno en $DEPLOY_DIR/.env"
echo "   especialmente UNIFI_HOST, UNIFI_API_KEY, JWT_SECRET y REDIS_PASSWORD"
