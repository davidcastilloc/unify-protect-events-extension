#!/bin/bash

# UniFi Protect Notifications - Script de Inicio Rápido
# Este script configura y ejecuta el sistema completo

set -e

echo "🔔 UniFi Protect Notifications - Inicio Rápido"
echo "=============================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes con color
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar Node.js
print_status "Verificando Node.js..."
if ! command -v node &> /dev/null; then
    print_error "Node.js no está instalado. Por favor instala Node.js 18+ desde https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js versión $NODE_VERSION detectada. Se requiere versión 18 o superior."
    exit 1
fi

print_success "Node.js $(node --version) detectado"

# Verificar npm
print_status "Verificando npm..."
if ! command -v npm &> /dev/null; then
    print_error "npm no está instalado."
    exit 1
fi

print_success "npm $(npm --version) detectado"

# Verificar si las dependencias están instaladas
if [ ! -d "node_modules" ]; then
    print_status "Instalando dependencias..."
    npm install
    print_success "Dependencias instaladas"
else
    print_success "Dependencias ya instaladas"
fi

# Verificar archivo .env
if [ ! -f ".env" ]; then
    print_warning "Archivo .env no encontrado"
    if [ -f "env.example" ]; then
        print_status "Copiando env.example a .env..."
        cp env.example .env
        print_warning "IMPORTANTE: Edita el archivo .env con tu configuración de UniFi Protect"
        print_warning "Ejecuta: nano .env"
        echo ""
        echo "Configuración mínima requerida:"
        echo "- UNIFI_HOST=192.168.1.100"
        echo "- UNIFI_USERNAME=admin"
        echo "- UNIFI_PASSWORD=tu_password"
        echo "- JWT_SECRET=tu_secret_muy_seguro"
        echo ""
        read -p "¿Quieres editar el .env ahora? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-nano} .env
        fi
    else
        print_error "Archivo env.example no encontrado"
        exit 1
    fi
else
    print_success "Archivo .env encontrado"
fi

# Crear directorio de logs
print_status "Creando directorio de logs..."
mkdir -p logs
print_success "Directorio de logs creado"

# Compilar TypeScript
print_status "Compilando TypeScript..."
npm run build
print_success "Compilación completada"

# Verificar puerto 3000
print_status "Verificando puerto 3000..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Puerto 3000 ya está en uso"
    echo "Procesos usando el puerto 3000:"
    lsof -Pi :3000 -sTCP:LISTEN
    echo ""
    read -p "¿Quieres continuar de todas formas? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Inicio cancelado"
        exit 1
    fi
else
    print_success "Puerto 3000 disponible"
fi

# Mostrar información de la extensión
echo ""
print_status "INFORMACIÓN DE LA EXTENSIÓN DE CHROME:"
echo "=============================================="
echo "1. Abre Chrome y navega a chrome://extensions/"
echo "2. Activa el 'Modo de desarrollador'"
echo "3. Haz clic en 'Cargar extensión descomprimida'"
echo "4. Selecciona la carpeta: $(pwd)/chrome-extension/"
echo "5. Configura la extensión en las opciones"
echo ""

# Preguntar si quiere iniciar el servidor
read -p "¿Quieres iniciar el servidor ahora? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Iniciando servidor..."
    echo ""
    print_success "Servidor iniciado en http://localhost:3000"
    print_success "Health check: http://localhost:3000/health"
    print_success "WebSocket: ws://localhost:3000/ws"
    echo ""
    print_warning "Presiona Ctrl+C para detener el servidor"
    echo ""
    
    # Iniciar el servidor
    npm start
else
    print_status "Para iniciar el servidor manualmente, ejecuta:"
    echo "npm start"
    echo ""
    print_status "Para modo desarrollo con hot-reload:"
    echo "npm run dev"
fi

echo ""
print_success "¡Configuración completada!"
print_status "Consulta README.md e INSTALACION.md para más detalles"
