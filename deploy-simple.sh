#!/bin/bash

# Script de despliegue simple para UniFi Protect Notifications
# Servidor: CentOS Stream 9 (10.0.0.108)

set -e

SERVER="10.0.0.108"
USER="root"
PASSWORD="100*PuertoPiritu"
DEPLOY_DIR="/opt/unifi-protect-notifications"

echo "🚀 Iniciando despliegue en $SERVER..."

# Función para ejecutar comandos SSH con contraseña
ssh_with_password() {
    local cmd="$1"
    echo "$PASSWORD" | sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$USER@$SERVER" "$cmd" 2>/dev/null || {
        echo "❌ Error ejecutando: $cmd"
        return 1
    }
}

# Verificar si sshpass está disponible
if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass no está instalado. Instalando..."
    # Intentar instalar sshpass
    if command -v pacman &> /dev/null; then
        echo "Instalando sshpass con pacman..."
        # Necesitamos permisos de root para esto
        echo "Por favor, ejecuta: sudo pacman -S sshpass"
        echo "O instala expect: sudo pacman -S expect"
        exit 1
    elif command -v apt &> /dev/null; then
        sudo apt update && sudo apt install -y sshpass
    elif command -v yum &> /dev/null; then
        sudo yum install -y sshpass
    else
        echo "No se pudo instalar sshpass automáticamente"
        exit 1
    fi
fi

echo "📡 Verificando conexión SSH..."
if ssh_with_password "echo 'Conexión SSH exitosa'"; then
    echo "✅ Conexión SSH establecida"
else
    echo "❌ Error: No se pudo conectar al servidor"
    echo "Verificando que el servidor esté accesible..."
    ping -c 1 "$SERVER" || echo "❌ Servidor no responde a ping"
    exit 1
fi

echo "📦 Instalando dependencias en el servidor..."
ssh_with_password "
    # Actualizar sistema
    dnf update -y
    
    # Instalar Docker si no está instalado
    if ! command -v docker &> /dev/null; then
        echo 'Instalando Docker...'
        dnf install -y dnf-plugins-core
        dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        systemctl enable docker
        systemctl start docker
        echo 'Docker instalado y iniciado'
    else
        echo 'Docker ya está instalado'
    fi
    
    # Crear directorio de despliegue
    mkdir -p /opt/unifi-protect-notifications
    cd /opt/unifi-protect-notifications
    
    echo '✅ Dependencias instaladas correctamente'
"

echo "⚙️ Configurando archivos en el servidor..."
ssh_with_password "
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

echo "📋 Copiando archivos de Docker Compose..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no docker-compose.vps.yml "$USER@$SERVER:$DEPLOY_DIR/docker-compose.yml"

echo "🐳 Desplegando aplicación con Docker Compose..."
ssh_with_password "
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

echo "🔍 Verificando despliegue..."
sleep 10  # Esperar a que la aplicación se inicie

if ssh_with_password "curl -f http://localhost:3001/health 2>/dev/null"; then
    echo "✅ ✅ Aplicación funcionando correctamente en http://10.0.0.108:3001"
else
    echo "⚠️ La aplicación se desplegó pero el health check no responde. Revisar logs:"
    ssh_with_password "cd /opt/unifi-protect-notifications && docker-compose logs --tail=50"
fi

echo ""
echo "🎉 Despliegue completado!"
echo "📍 URL de acceso: http://10.0.0.108:3001"
echo "📊 Estado: docker-compose ps (en el servidor)"
echo "📝 Logs: docker-compose logs -f (en el servidor)"
echo ""
echo "⚠️ IMPORTANTE: Actualiza las variables de entorno en /opt/unifi-protect-notifications/.env"
echo "   especialmente UNIFI_HOST, UNIFI_API_KEY, JWT_SECRET y REDIS_PASSWORD"
