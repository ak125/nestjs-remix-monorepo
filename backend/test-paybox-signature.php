<?php
// Test de génération de signature Paybox EXACTEMENT comme le PHP production

$sitemerchantsite = "5259250";
$sitemerchantrang = "001";
$sitemerchantid = "822188223";
$amountTOPAY = "55847"; // 558.47 EUR en centimes
$commande_id_injected_Paybox = "TEST-ORDER-123";
$mailcltTOPAY = "test@test.com";
$dateTimePaybox = "2025-11-04T17:43:16+00:00"; // Format ISO8601

$CertificatTest = getenv('PAYBOX_HMAC_KEY');
if ($CertificatTest === false || $CertificatTest === '') {
    fwrite(STDERR, "PAYBOX_HMAC_KEY manquant - exporter la cle avant de lancer ce script.\n");
    exit(1);
}

$signaturePayboxCHAINE = "PBX_SITE=" . $sitemerchantsite .
    "&PBX_RANG=" . $sitemerchantrang .
    "&PBX_IDENTIFIANT=" . $sitemerchantid .
    "&PBX_TOTAL=" . $amountTOPAY .
    "&PBX_DEVISE=978" .
    "&PBX_CMD=" . $commande_id_injected_Paybox .
    "&PBX_PORTEUR=" . $mailcltTOPAY .
    "&PBX_RETOUR=Mt:M;Ref:R;Auto:A;Erreur:E" .
    "&PBX_HASH=SHA512" .
    "&PBX_TIME=" . $dateTimePaybox;

$binKey = pack("H*", $CertificatTest);
$signaturePaybox = strtoupper(hash_hmac('sha512', $signaturePayboxCHAINE, $binKey));

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "🔍 TEST SIGNATURE PAYBOX PHP\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
echo "📝 Signature string:\n";
echo $signaturePayboxCHAINE . "\n\n";
echo "🔐 HMAC-SHA512 signature:\n";
echo $signaturePaybox . "\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
?>
