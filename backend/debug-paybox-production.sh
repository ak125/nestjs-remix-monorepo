#!/bin/bash

# Script de débogage Paybox PRODUCTION

echo "======================================"
echo "🔍 DIAGNOSTIC PAYBOX PRODUCTION"
echo "======================================"
echo ""

# Vérifier la configuration
echo "1️⃣ Configuration actuelle:"
echo "=========================="
echo "PAYBOX_SITE: $(grep '^PAYBOX_SITE=' .env | cut -d'=' -f2)"
echo "PAYBOX_RANG: $(grep '^PAYBOX_RANG=' .env | cut -d'=' -f2)"
echo "PAYBOX_IDENTIFIANT: $(grep '^PAYBOX_IDENTIFIANT=' .env | cut -d'=' -f2)"
echo "PAYBOX_MODE: $(grep '^PAYBOX_MODE=' .env | cut -d'=' -f2)"
echo "PAYBOX_PAYMENT_URL: $(grep '^PAYBOX_PAYMENT_URL=' .env | cut -d'=' -f2)"
HMAC_KEY=$(grep '^PAYBOX_HMAC_KEY=' .env | cut -d'=' -f2)
echo "PAYBOX_HMAC_KEY: ${HMAC_KEY:0:20}...${HMAC_KEY: -20} (masqué)"
echo ""

# Vérifier la longueur de la clé HMAC
HMAC_LENGTH=${#HMAC_KEY}
echo "2️⃣ Validation de la clé HMAC:"
echo "=============================="
echo "Longueur de la clé: $HMAC_LENGTH caractères"
if [ $HMAC_LENGTH -eq 128 ]; then
    echo "✅ Longueur correcte (128 caractères = 512 bits)"
else
    echo "⚠️  Longueur anormale (devrait être 128 caractères)"
fi
echo ""

# Vérifier si l'application est en cours d'exécution
echo "3️⃣ État de l'application:"
echo "=========================="
if command -v pm2 &> /dev/null; then
    pm2 list | grep -E "backend|nestjs" || echo "Aucun processus backend trouvé"
elif command -v docker &> /dev/null; then
    docker ps | grep backend || echo "Aucun container backend trouvé"
else
    echo "PM2 ou Docker non détecté"
fi
echo ""

# Vérifier les logs récents
echo "4️⃣ Logs récents (Paybox):"
echo "=========================="
if command -v pm2 &> /dev/null; then
    pm2 logs backend --nostream --lines 20 2>/dev/null | grep -i "paybox\|formulaire\|hmac\|signature" | tail -10
elif [ -d "logs" ]; then
    tail -50 logs/app-*.log 2>/dev/null | grep -i "paybox\|formulaire" | tail -10
else
    echo "Aucun log trouvé"
fi
echo ""

# Test de connexion à l'API
echo "5️⃣ Test de l'endpoint API:"
echo "==========================="
if curl -s http://localhost:3000/health &> /dev/null; then
    echo "✅ Backend accessible sur localhost:3000"
    echo ""
    echo "Test de l'endpoint Paybox..."
    curl -v "http://localhost:3000/api/paybox/redirect?orderId=TEST$(date +%s)&amount=1.00&email=test@example.com" 2>&1 | head -30
else
    echo "❌ Backend non accessible sur localhost:3000"
    echo "Ports en écoute:"
    netstat -tlnp 2>/dev/null | grep LISTEN | grep -E "300[0-9]|808[0-9]" || echo "Aucun port trouvé"
fi
echo ""

echo "======================================"
echo "📋 ACTIONS RECOMMANDÉES:"
echo "======================================"
echo ""
echo "Si l'erreur persiste, vérifier:"
echo ""
echo "1. Les valeurs exactes fournies par Paybox:"
echo "   • SITE, RANG, IDENTIFIANT doivent correspondre EXACTEMENT"
echo "   • La clé HMAC doit être celle de PRODUCTION"
echo ""
echo "2. Redémarrer l'application:"
echo "   pm2 restart backend"
echo "   pm2 logs backend --lines 50"
echo ""
echo "3. Tester un paiement:"
echo "   Aller sur: http://$(hostname -I | awk '{print $1}')/checkout-payment"
echo ""
echo "4. Vérifier les logs en temps réel:"
echo "   pm2 logs backend -f | grep -i paybox"
echo ""
echo "5. Contacter le support Paybox si le problème persiste:"
echo "   https://www.paybox.com/contact/"
echo "   Fournir: SITE=5259250, RANG=001, IDENTIFIANT=822188223"
echo "======================================"
