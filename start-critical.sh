#!/bin/bash

# 🚨 SCRIPT DE INICIO CRÍTICO - SISTEMA NUNCA DESCONECTADO
# Este script inicia el sistema con configuración crítica

set -e  # Salir si cualquier comando falla

echo "🚨 INICIANDO SISTEMA CRÍTICO - NUNCA DESCONECTADO"
echo "================================================"

# Verificar que Node.js esté instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    exit 1
fi

# Verificar que npm esté instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado"
    exit 1
fi

# Crear directorios necesarios
echo "📁 Creando directorios necesarios..."
mkdir -p logs
mkdir -p data/events

# Verificar archivo de configuración crítica
if [ ! -f "env.critical" ]; then
    echo "❌ Archivo env.critical no encontrado"
    echo "💡 Copia env.example a env.critical y configura las variables"
    exit 1
fi

# Instalar dependencias si es necesario
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Compilar TypeScript si es necesario
if [ ! -d "dist" ]; then
    echo "🔨 Compilando TypeScript..."
    npm run build
fi

# Verificar que el puerto esté disponible
PORT=${PORT:-3000}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Puerto $PORT ya está en uso"
    echo "💡 Deteniendo proceso anterior..."
    pkill -f "node.*server" || true
    sleep 2
fi

# Cargar variables de entorno críticas
echo "🔧 Cargando configuración crítica..."
export $(cat env.critical | grep -v '^#' | xargs)

# Verificar variables críticas
if [ -z "$UNIFI_HOST" ]; then
    echo "❌ UNIFI_HOST no está configurado en env.critical"
    exit 1
fi

if [ -z "$UNIFI_API_KEY" ]; then
    echo "❌ UNIFI_API_KEY no está configurado en env.critical"
    exit 1
fi

echo "✅ Configuración crítica cargada"
echo "🏠 UniFi Host: $UNIFI_HOST"
echo "🔑 API Key: ${UNIFI_API_KEY:0:8}..."
echo "🌐 Puerto: $PORT"

# Función para limpiar al salir
cleanup() {
    echo ""
    echo "🛑 Deteniendo sistema crítico..."
    
    # Detener monitor si está corriendo
    if [ ! -z "$MONITOR_PID" ]; then
        echo "📊 Deteniendo monitor crítico (PID: $MONITOR_PID)..."
        kill $MONITOR_PID 2>/dev/null || true
    fi
    
    # Detener servidor principal
    if [ ! -z "$SERVER_PID" ]; then
        echo "🖥️  Deteniendo servidor principal (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
    fi
    
    echo "✅ Sistema crítico detenido"
    exit 0
}

# Configurar señales de terminación
trap cleanup SIGINT SIGTERM

# Iniciar monitor crítico en background
echo "📊 Iniciando monitor crítico..."
node monitor-critical.js &
MONITOR_PID=$!
echo "📊 Monitor crítico iniciado (PID: $MONITOR_PID)"

# Esperar un poco para que el monitor se inicie
sleep 2

# Iniciar servidor principal
echo "🖥️  Iniciando servidor principal..."
node dist/server.js &
SERVER_PID=$!
echo "🖥️  Servidor principal iniciado (PID: $SERVER_PID)"

# Mostrar información de conexión
echo ""
echo "🚨 SISTEMA CRÍTICO INICIADO"
echo "=========================="
echo "🌐 Servidor: http://localhost:$PORT"
echo "🔍 Health Check: http://localhost:$PORT/health"
echo "🚨 Estado Crítico: http://localhost:$PORT/critical-status"
echo "🎮 Simulación: http://localhost:$PORT/simulation"
echo ""
echo "📊 Monitor: Verificando cada 5 segundos"
echo "💓 Heartbeat UniFi: Cada 2 segundos"
echo "💓 Heartbeat Clientes: Cada 3 segundos"
echo ""
echo "🛑 Presiona Ctrl+C para detener el sistema"
echo ""

# Función para mostrar estado cada 30 segundos
show_status() {
    echo "📊 Estado del Sistema:"
    echo "  - Servidor: http://localhost:$PORT/health"
    echo "  - Clientes conectados: $(curl -s http://localhost:$PORT/health | jq -r '.clients // "N/A"' 2>/dev/null || echo "N/A")"
    echo "  - Monitor PID: $MONITOR_PID"
    echo "  - Servidor PID: $SERVER_PID"
    echo ""
}

# Mostrar estado inicial
show_status

# Loop principal - mostrar estado cada 30 segundos
while true; do
    sleep 30
    show_status
done
