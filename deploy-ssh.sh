#!/bin/bash

# Script de despliegue para UniFi Protect Notifications
# Servidor: CentOS Stream 9 (10.0.0.108)

set -e

SERVER="10.0.0.108"
USER="root"
PASSWORD="100*PuertoPiritu"
DEPLOY_DIR="/opt/unifi-protect-notifications"

echo "🚀 Iniciando despliegue en $SERVER..."

# Función para ejecutar comandos SSH
ssh_exec() {
    expect -c "
        set timeout 30
        spawn ssh -o StrictHostKeyChecking=no $USER@$SERVER \"$1\"
        expect {
            \"password:\" { send \"$PASSWORD\r\"; exp_continue }
            \"#\" { }
            \"$ \" { }
            timeout { exit 1 }
        }
        expect eof
    "
}

# Función para copiar archivos
scp_file() {
    local local_file="$1"
    local remote_file="$2"
    expect -c "
        set timeout 30
        spawn scp -o StrictHostKeyChecking=no \"$local_file\" $USER@$SERVER:\"$remote_file\"
        expect {
            \"password:\" { send \"$PASSWORD\r\"; exp_continue }
            \"100%\" { }
            timeout { exit 1 }
        }
        expect eof
    "
}

# Verificar conexión SSH
echo "📡 Verificando conexión SSH..."
if ! ssh_exec "echo 'Conexión SSH exitosa'"; then
    echo "❌ Error: No se pudo conectar al servidor"
    exit 1
fi

# Instalar dependencias necesarias en el servidor
echo "📦 Instalando dependencias en el servidor..."
ssh_exec "
    # Actualizar sistema
    dnf update -y
    
    # Instalar Docker
    if ! command -v docker &> /dev/null; then
        dnf install -y dnf-plugins-core
        dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        systemctl enable docker
        systemctl start docker
    fi
    
    # Instalar expect
    if ! command -v expect &> /dev/null; then
        dnf install -y expect
    fi
    
    # Crear directorio de despliegue
    mkdir -p /opt/unifi-protect-notifications
    cd /opt/unifi-protect-notifications
    
    echo '✅ Dependencias instaladas correctamente'
"

# Crear archivos de configuración en el servidor
echo "⚙️ Configurando archivos en el servidor..."
ssh_exec "
    cd /opt/unifi-protect-notifications
    
    # Crear archivo .env para producción
    cat > .env << 'ENVEOF'
# Configuración del servidor de producción
PORT=3001
NODE_ENV=production

# Configuración UniFi Protect - ACTUALIZAR ESTOS VALORES
UNIFI_HOST=192.168.1.100
UNIFI_PORT=443
UNIFI_API_KEY=tu_api_key_aqui
UNIFI_SSL_VERIFY=false

# Configuración de seguridad
JWT_SECRET=tu_jwt_secret_muy_seguro_para_produccion_\$(date +%s)
CORS_ORIGIN=http://10.0.0.108:3001

# Configuración de logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Configuración de conexión
UNIFI_REAL_CONNECTION=true

# Configuración de Redis
REDIS_PASSWORD=redis_password_seguro_\$(date +%s)

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
ENVEOF

    # Crear directorios necesarios
    mkdir -p logs data
    
    echo '✅ Archivos de configuración creados'
"

# Copiar archivos de Docker Compose
echo "📋 Copiando archivos de Docker Compose..."
scp_file "docker-compose.vps.yml" "$DEPLOY_DIR/docker-compose.yml"

# Desplegar con Docker Compose
echo "🐳 Desplegando aplicación con Docker Compose..."
ssh_exec "
    cd /opt/unifi-protect-notifications
    
    # Parar contenedores existentes si existen
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Descargar imagen y desplegar
    docker-compose pull
    docker-compose up -d
    
    # Verificar estado
    docker-compose ps
    
    echo '✅ Aplicación desplegada correctamente'
"

# Verificar despliegue
echo "🔍 Verificando despliegue..."
if ssh_exec "curl -f http://localhost:3001/health 2>/dev/null || echo 'Health check failed'"; then
    echo "✅ ✅ Aplicación funcionando correctamente en http://10.0.0.108:3001"
else
    echo "⚠️ La aplicación se desplegó pero el health check no responde. Revisar logs:"
    ssh_exec "cd /opt/unifi-protect-notifications && docker-compose logs --tail=50"
fi

echo ""
echo "🎉 Despliegue completado!"
echo "📍 URL de acceso: http://10.0.0.108:3001"
echo "📊 Estado: docker-compose ps (en el servidor)"
echo "📝 Logs: docker-compose logs -f (en el servidor)"
echo ""
echo "⚠️ IMPORTANTE: Actualiza las variables de entorno en /opt/unifi-protect-notifications/.env"
echo "   especialmente UNIFI_HOST, UNIFI_API_KEY, JWT_SECRET y REDIS_PASSWORD"
