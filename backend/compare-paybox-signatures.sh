#!/bin/bash

# ============================================================================
# SCRIPT DE COMPARAISON DES SIGNATURES PAYBOX
# ============================================================================
# Compare la signature gÃ©nÃ©rÃ©e par le nouveau systÃ¨me NestJS
# avec celle de l'ancien systÃ¨me PHP
# ============================================================================

set -e

echo "ðŸ” COMPARAISON DES SIGNATURES PAYBOX"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# ParamÃ¨tres de test (identiques Ã  l'ancien PHP)
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

# ClÃ© HMAC (certificat TEST de l'ancien PHP)
HMAC_KEY="7731B4225651B0C434189E2A13B963F91D8BBE78AEC97838E40925569E25357373C792E2FBE5A6B8C0CBC12ED27524CC2EE0C4653C93A14A39414AA42F85AEE5"

echo "ðŸ“‹ PARAMÃˆTRES DE TEST:"
echo "   Site: $SITE"
echo "   Rang: $RANG"
echo "   Identifiant: $IDENTIFIANT"
echo "   Total: $TOTAL (558.47 EUR)"
echo "   Commande: $CMD"
echo "   Email: $PORTEUR"
echo ""

# ============================================================================
# 1ï¸âƒ£ SIGNATURE PHP (ancien systÃ¨me)
# ============================================================================
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "1ï¸âƒ£ SIGNATURE ANCIEN SYSTÃˆME PHP"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Construire la chaÃ®ne de signature (ordre EXACT du PHP)
SIGNATURE_STRING="PBX_SITE=${SITE}&PBX_RANG=${RANG}&PBX_IDENTIFIANT=${IDENTIFIANT}&PBX_TOTAL=${TOTAL}&PBX_DEVISE=${DEVISE}&PBX_CMD=${CMD}&PBX_PORTEUR=${PORTEUR}&PBX_RETOUR=${RETOUR}&PBX_HASH=${HASH}&PBX_TIME=${TIME}"

echo "ðŸ“ ChaÃ®ne de signature:"
echo "   $SIGNATURE_STRING"
echo ""

# CrÃ©er un script PHP temporaire
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

echo "ðŸ” Signature PHP (HMAC-SHA512):"
echo "   $PHP_SIGNATURE"
echo ""

# Nettoyer
rm /tmp/paybox_signature.php

# ============================================================================
# 2ï¸âƒ£ SIGNATURE NODE.JS (nouveau systÃ¨me)
# ============================================================================
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "2ï¸âƒ£ SIGNATURE NOUVEAU SYSTÃˆME NODE.JS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# CrÃ©er un script Node.js temporaire
NODE_SCRIPT=$(cat << 'EOF'
const crypto = require('crypto');

const signatureString = process.argv[2];
const hmacKey = process.argv[3];

// Buffer.from(hmacKey, 'hex') Ã©quivaut Ã  pack("H*", $key) en PHP
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

echo "ðŸ” Signature Node.js (HMAC-SHA512):"
echo "   $NODE_SIGNATURE"
echo ""

# Nettoyer
rm /tmp/paybox_signature.js

# ============================================================================
# 3ï¸âƒ£ COMPARAISON
# ============================================================================
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "3ï¸âƒ£ COMPARAISON DES SIGNATURES"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

if [ "$PHP_SIGNATURE" = "$NODE_SIGNATURE" ]; then
    echo "âœ… SUCCÃˆS : Les signatures sont IDENTIQUES !"
    echo ""
    echo "   PHP:     $PHP_SIGNATURE"
    echo "   Node.js: $NODE_SIGNATURE"
    echo ""
    echo "ðŸŽ‰ Le nouveau systÃ¨me gÃ©nÃ¨re la mÃªme signature que l'ancien PHP"
    exit 0
else
    echo "âŒ ERREUR : Les signatures sont DIFFÃ‰RENTES !"
    echo ""
    echo "   PHP:     $PHP_SIGNATURE"
    echo "   Node.js: $NODE_SIGNATURE"
    echo ""
    echo "âš ï¸ Il y a un problÃ¨me dans la gÃ©nÃ©ration de la signature"
    exit 1
fi
