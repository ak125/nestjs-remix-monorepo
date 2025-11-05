#!/bin/bash

# ============================================================================
# SCRIPT DE COMPARAISON DES SIGNATURES PAYBOX
# ============================================================================
# Compare la signature générée par le nouveau système NestJS
# avec celle de l'ancien système PHP
# ============================================================================

set -e

echo "🔐 COMPARAISON DES SIGNATURES PAYBOX"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Paramètres de test (identiques à l'ancien PHP)
SITE="5259250"
RANG="001"
IDENTIFIANT="822188223"
TOTAL="55847"  # 558.47 EUR en centimes
DEVISE="978"   # EUR
CMD="ORD-1762342232364-964"
PORTEUR="monia123@gmail.com"
RETOUR="Mt:M;Ref:R;Auto:A;Erreur:E"
HASH="SHA512"
TIME="2025-11-05T11:30:39+01:00"  # Format ISO 8601

# Clé HMAC (certificat TEST de l'ancien PHP)
HMAC_KEY="7731B4225651B0C434189E2A13B963F91D8BBE78AEC97838E40925569E25357373C792E2FBE5A6B8C0CBC12ED27524CC2EE0C4653C93A14A39414AA42F85AEE5"

echo "📋 PARAMÈTRES DE TEST:"
echo "   Site: $SITE"
echo "   Rang: $RANG"
echo "   Identifiant: $IDENTIFIANT"
echo "   Total: $TOTAL (558.47 EUR)"
echo "   Commande: $CMD"
echo "   Email: $PORTEUR"
echo ""

# ============================================================================
# 1️⃣ SIGNATURE PHP (ancien système)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣ SIGNATURE ANCIEN SYSTÈME PHP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Construire la chaîne de signature (ordre EXACT du PHP)
SIGNATURE_STRING="PBX_SITE=${SITE}&PBX_RANG=${RANG}&PBX_IDENTIFIANT=${IDENTIFIANT}&PBX_TOTAL=${TOTAL}&PBX_DEVISE=${DEVISE}&PBX_CMD=${CMD}&PBX_PORTEUR=${PORTEUR}&PBX_RETOUR=${RETOUR}&PBX_HASH=${HASH}&PBX_TIME=${TIME}"

echo "📝 Chaîne de signature:"
echo "   $SIGNATURE_STRING"
echo ""

# Créer un script PHP temporaire
PHP_SCRIPT=$(cat << 'EOF'
<?php
$signatureString = $argv[1];
$hmacKey = $argv[2];

// pack("H*", $key) comme dans l'ancien PHP
$binKey = pack("H*", $hmacKey);

// hash_hmac('sha512', $string, $binKey)
$signature = strtoupper(hash_hmac('sha512', $signatureString, $binKey));

echo $signature;
?>
EOF
)

echo "$PHP_SCRIPT" > /tmp/paybox_signature.php

# Calculer la signature avec PHP
PHP_SIGNATURE=$(php /tmp/paybox_signature.php "$SIGNATURE_STRING" "$HMAC_KEY")

echo "🔐 Signature PHP (HMAC-SHA512):"
echo "   $PHP_SIGNATURE"
echo ""

# Nettoyer
rm /tmp/paybox_signature.php

# ============================================================================
# 2️⃣ SIGNATURE NODE.JS (nouveau système)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣ SIGNATURE NOUVEAU SYSTÈME NODE.JS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Créer un script Node.js temporaire
NODE_SCRIPT=$(cat << 'EOF'
const crypto = require('crypto');

const signatureString = process.argv[2];
const hmacKey = process.argv[3];

// Buffer.from(hmacKey, 'hex') équivaut à pack("H*", $key) en PHP
const keyBuffer = Buffer.from(hmacKey, 'hex');

// crypto.createHmac('sha512', keyBuffer)
const hmac = crypto.createHmac('sha512', keyBuffer);
hmac.update(signatureString);
const signature = hmac.digest('hex').toUpperCase();

console.log(signature);
EOF
)

echo "$NODE_SCRIPT" > /tmp/paybox_signature.js

# Calculer la signature avec Node.js
NODE_SIGNATURE=$(node /tmp/paybox_signature.js "$SIGNATURE_STRING" "$HMAC_KEY")

echo "🔐 Signature Node.js (HMAC-SHA512):"
echo "   $NODE_SIGNATURE"
echo ""

# Nettoyer
rm /tmp/paybox_signature.js

# ============================================================================
# 3️⃣ COMPARAISON
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣ COMPARAISON DES SIGNATURES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$PHP_SIGNATURE" = "$NODE_SIGNATURE" ]; then
    echo "✅ SUCCÈS : Les signatures sont IDENTIQUES !"
    echo ""
    echo "   PHP:     $PHP_SIGNATURE"
    echo "   Node.js: $NODE_SIGNATURE"
    echo ""
    echo "🎉 Le nouveau système génère la même signature que l'ancien PHP"
    exit 0
else
    echo "❌ ERREUR : Les signatures sont DIFFÉRENTES !"
    echo ""
    echo "   PHP:     $PHP_SIGNATURE"
    echo "   Node.js: $NODE_SIGNATURE"
    echo ""
    echo "⚠️ Il y a un problème dans la génération de la signature"
    exit 1
fi
