#!/bin/bash

# Script para alternar entre conexión real y simulación
# UniFi Protect Notifications

set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔔 UniFi Protect Notifications - Toggle Connection${NC}"
echo "=================================================="

# Verificar si existe archivo .env
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Archivo .env no encontrado${NC}"
    echo "Ejecuta: cp env.example .env"
    exit 1
fi

# Verificar estado actual
if grep -q "UNIFI_REAL_CONNECTION=true" .env; then
    CURRENT_MODE="REAL"
    CURRENT_COLOR=$GREEN
else
    CURRENT_MODE="SIMULATION"
    CURRENT_COLOR=$YELLOW
fi

echo -e "Estado actual: ${CURRENT_COLOR}${CURRENT_MODE}${NC}"

echo ""
echo "Opciones:"
echo "1) Activar conexión REAL"
echo "2) Activar modo SIMULACIÓN"
echo "3) Solo mostrar estado"
echo ""

read -p "Selecciona una opción (1-3): " choice

case $choice in
    1)
        echo -e "${GREEN}🚀 Activando conexión REAL...${NC}"
        sed -i 's/UNIFI_REAL_CONNECTION=false/UNIFI_REAL_CONNECTION=true/' .env
        echo -e "${GREEN}✅ Conexión REAL activada${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
        echo "1. Configura las credenciales reales en .env:"
        echo "   - UNIFI_HOST=tu_ip_real"
        echo "   - UNIFI_USERNAME=tu_usuario_real"
        echo "   - UNIFI_PASSWORD=tu_password_real"
        echo ""
        echo "2. Reinicia el servidor:"
        echo "   npm start"
        ;;
    2)
        echo -e "${YELLOW}🧪 Activando modo SIMULACIÓN...${NC}"
        sed -i 's/UNIFI_REAL_CONNECTION=true/UNIFI_REAL_CONNECTION=false/' .env
        echo -e "${YELLOW}✅ Modo SIMULACIÓN activado${NC}"
        echo ""
        echo "El servidor usará eventos simulados para testing."
        echo "Reinicia el servidor: npm start"
        ;;
    3)
        echo -e "Estado actual: ${CURRENT_COLOR}${CURRENT_MODE}${NC}"
        if [ "$CURRENT_MODE" = "REAL" ]; then
            echo ""
            echo "Para usar conexión real, asegúrate de configurar:"
            echo "- UNIFI_HOST: IP de tu UniFi Protect"
            echo "- UNIFI_USERNAME: Usuario válido"
            echo "- UNIFI_PASSWORD: Contraseña correcta"
        fi
        ;;
    *)
        echo -e "${RED}❌ Opción inválida${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}📋 Comandos útiles:${NC}"
echo "npm start          # Iniciar servidor"
echo "npm run dev        # Modo desarrollo"
echo "./start.sh         # Script de inicio completo"
echo ""
