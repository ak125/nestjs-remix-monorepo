-- =====================================================
-- Script: Create ___legal_pages table for Automecanik
-- Date: 2025-12-18
-- Description: Dedicated table for legal content (CGV, CGU, etc.)
-- =====================================================

-- Create the legal pages table
CREATE TABLE IF NOT EXISTS ___legal_pages (
  id SERIAL PRIMARY KEY,
  alias VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  h1 VARCHAR(255),
  content TEXT NOT NULL,
  description TEXT,
  keywords VARCHAR(500),
  breadcrumb VARCHAR(255),
  indexable BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  effective_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on alias for faster lookups
CREATE INDEX IF NOT EXISTS idx_legal_pages_alias ON ___legal_pages(alias);

-- Insert legal content
-- =====================================================

-- 1. CGV - Conditions Générales de Vente
INSERT INTO ___legal_pages (alias, title, h1, description, keywords, breadcrumb, content, indexable)
VALUES (
  'cgv',
  'Conditions Générales de Vente - Automecanik',
  'Conditions Générales de Vente',
  'Consultez les conditions générales de vente d''Automecanik : prix, commandes, livraison, paiement, garantie et droit de rétractation.',
  'CGV, conditions générales de vente, automecanik, pièces auto',
  'CGV',
  '<h2>1. Introduction</h2>
<p>La société AUTO PIÈCES EQUIPEMENTS est une société SASU de droit français au capital de 8.000 Euros dont le siège social est situé 184 avenue Aristide Briand, 93320 Les Pavillons-sous-Bois, France – Tél : 01 77 69 58 92 et immatriculée au registre du commerce sous le numéro RCS 820 499 994.</p>
<p>Les présentes conditions générales de vente s''appliquent à tous les Produits vendus par la Société AUTO PIÈCES EQUIPEMENTS sur le Site Internet et livrés en France métropolitaine et en Corse.</p>

<h2>2. Produits</h2>
<h3>2.1. Informations sur les produits</h3>
<p>Tous les Produits proposés à la vente sur le Site Internet sont des produits neufs, conformes à la législation européenne en vigueur et aux normes applicables en Europe.</p>
<p>Les photographies des Produits mis en vente sur le Site Internet sont les plus fidèles possibles mais ne peuvent assurer une similitude parfaite aux Produits offerts.</p>

<h3>2.2. Disponibilité</h3>
<p>AUTO PIÈCES EQUIPEMENTS s''engage à honorer les commandes dans la limite des stocks disponibles chez ses fournisseurs.</p>
<p>En cas de non disponibilité du produit commandé, AUTO PIÈCES EQUIPEMENTS proposera un produit de remplacement ou un remboursement dans un délai de 30 jours.</p>

<h2>3. Prix</h2>
<h3>3.1. Prix catalogue</h3>
<p>Les prix des Produits vendus sur le Site sont indiqués en Euros Toutes Taxes Comprises hors participation aux frais d''expédition.</p>
<p>Le Prix facturé au Client sera celui en vigueur au moment de la Commande.</p>

<h3>3.2. Factures</h3>
<p>Chaque commande passée sur notre site internet aura une facture établie par la société, mentionnant le prix total de la commande (T.T.C) avec les frais de livraison supplémentaires.</p>

<h2>4. Commande</h2>
<h3>4.1. Généralité</h3>
<p>Pour passer une commande, le client dispose d''un seul et unique moyen via notre site internet en ligne 7j/7 et 24h/24.</p>

<h3>4.2. Informations personnelles</h3>
<p>Le client doit fournir des informations personnelles lors de la commande (nom, prénom, e-mail, adresse de livraison, adresse de facturation, numéro de téléphone valide).</p>

<h3>4.3. Confirmation de la commande</h3>
<p>Un mail de confirmation de la commande sera envoyé au client afin de récapituler les informations contractuelles.</p>

<h2>5. Livraison</h2>
<p>Les produits commandés sont livrés à l''adresse de livraison indiquée par le Client. Les frais de livraison sont toujours à la charge du Client.</p>
<p>Le délai de livraison dépend du délai de préparation et d''acheminement du colis.</p>

<h2>6. Paiement</h2>
<p>Plusieurs modes de paiement sont offerts au client :</p>
<ul>
<li>Règlement en ligne par carte bancaire (Carte Bleue, VISA, Eurocard/Mastercard)</li>
<li>Règlement par chèque bancaire</li>
<li>Règlement par virement bancaire</li>
<li>Règlement par PAYPAL</li>
</ul>
<p>Tout paiement en ligne effectué par carte bancaire est assuré grâce à Paybox System.</p>

<h2>7. Droit de rétractation et retour produits</h2>
<h3>7.1. Droit de rétractation</h3>
<p>Conformément aux articles du Code de la Consommation, vous disposez d''un droit de rétractation de 14 jours ouvrés à compter de la réception de la commande.</p>

<h3>7.2. Droit de retour produit</h3>
<p>Le client doit contacter le Service Clients au 01 77 69 58 92 pour convenir des modalités du retour.</p>
<p>Adresse de retour : AUTO PIÈCES EQUIPEMENTS - Service Retours - 184 avenue Aristide Briand, 93320 Les Pavillons-sous-Bois, France.</p>

<h2>8. Garantie</h2>
<p>Les produits proposés par la société AUTO PIÈCES EQUIPEMENTS bénéficient d''une garantie légale prévue par les articles 1641 et suivants du Code civil.</p>
<p>Certains Produits bénéficient de la garantie du fabricant qui est en général d''un an.</p>

<h2>9. Propriété intellectuelle</h2>
<p>Tous les éléments du site sont et restent la propriété intellectuelle et exclusive de AUTO PIÈCES EQUIPEMENTS.</p>

<h2>10. Loi applicable</h2>
<p>Les présentes conditions générales de vente sont soumises à la loi française. Les tribunaux de PARIS seront compétents pour les professionnels.</p>

<h2>11. Protection des données</h2>
<p>Ce site respecte le traitement des données personnelles conformément à la loi n° 78-17 du 6 janvier 1978 relative à l''informatique, aux fichiers et aux libertés.</p>
<p>Pour exercer vos droits, contactez-nous à contact@automecanik.com</p>',
  true
) ON CONFLICT (alias) DO UPDATE SET
  title = EXCLUDED.title,
  h1 = EXCLUDED.h1,
  description = EXCLUDED.description,
  content = EXCLUDED.content,
  updated_at = NOW();

-- 2. CDU - Conditions d'Utilisation
INSERT INTO ___legal_pages (alias, title, h1, description, keywords, breadcrumb, content, indexable)
VALUES (
  'cdu',
  'Conditions d''Utilisation - Automecanik',
  'Conditions d''Utilisation',
  'Conditions d''utilisation du site Automecanik : règles d''accès, propriété intellectuelle et responsabilités.',
  'CGU, conditions utilisation, automecanik',
  'Conditions d''Utilisation',
  '<h2>1. Objectif</h2>
<p>Le présent document a pour objet de définir les modalités et conditions dans lesquelles la société AUTO PIÈCES EQUIPEMENTS met à la disposition de ses utilisateurs le site, et les services disponibles.</p>

<h2>2. Propriété intellectuelle</h2>
<p>La structure générale du site www.automecanik.com, ainsi que les textes, graphiques, images, sons et vidéos, sont la propriété de la société AUTO PIÈCES EQUIPEMENTS.</p>
<p>Toute représentation et/ou reproduction et/ou exploitation partielle ou totale des contenus et services proposés par le site, sans l''autorisation préalable et écrite de AUTO PIÈCES EQUIPEMENTS est strictement interdite.</p>

<h2>3. Liens hypertextes</h2>
<p>Le site www.automecanik.com peut contenir des liens hypertextes renvoyant vers d''autres sites Internet gérés par des tiers.</p>
<p>La société AUTO PIÈCES EQUIPEMENTS n''est pas responsable du contenu des sites accessibles via ces liens.</p>

<h2>4. Cookies</h2>
<p>Le site Auto MecaniK utilise des cookies pour :</p>
<ul>
<li>Vous identifier lorsque vous vous connectez</li>
<li>Fournir des recommandations sur nos produits</li>
<li>Afficher du contenu personnalisé</li>
<li>Conserver le suivi de votre panier</li>
<li>Améliorer la sécurité</li>
</ul>

<h2>5. Responsabilité</h2>
<p>Les informations figurant sur ce site proviennent de sources considérées comme fiables. Toutefois, elles peuvent contenir des inexactitudes.</p>
<p>AUTO PIÈCES EQUIPEMENTS se réserve le droit de les corriger dès que ces erreurs sont portées à sa connaissance.</p>

<h2>6. Accès au site</h2>
<p>AUTO PIÈCES EQUIPEMENTS s''efforce de permettre l''accès au site 24/24H, 7/7J, sauf en cas de force majeure ou de maintenance.</p>',
  true
) ON CONFLICT (alias) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

-- 3. CPUC - Protection des Données (Privacy)
INSERT INTO ___legal_pages (alias, title, h1, description, keywords, breadcrumb, content, indexable)
VALUES (
  'cpuc',
  'Politique de Confidentialité - Automecanik',
  'Protection des Données Personnelles',
  'Politique de confidentialité et protection des données personnelles sur Automecanik. RGPD et vos droits.',
  'confidentialité, RGPD, données personnelles, automecanik',
  'Confidentialité',
  '<h2>Protection des données personnelles</h2>
<p>Vous pouvez acheter en ligne vos pièces détachées auto sur AutoMecaniK.com et passer vos commandes en ligne 7j/7 et 24h/24.</p>

<h2>Recherche de pièces auto</h2>
<ul>
<li>Utilisez notre sélecteur de recherche par véhicule pour identifier la marque, le modèle et la motorisation</li>
<li>Si vous connaissez la référence de la pièce, utilisez la recherche par référence</li>
<li>Vous pouvez aussi utiliser votre type mine (champs D.2 ou D.2.1 de la carte grise)</li>
</ul>

<h2>Passer une commande</h2>
<ol>
<li>Trouvez votre pièce et cliquez sur « ajouter au panier »</li>
<li>Vérifiez les détails de votre commande</li>
<li>Créez votre compte client si ce n''est pas déjà fait</li>
<li>Sélectionnez le mode de livraison et de paiement</li>
<li>Acceptez les conditions générales de vente</li>
<li>Validez votre commande</li>
</ol>

<h2>Vos droits RGPD</h2>
<p>Conformément à la loi n° 78-17 du 6 janvier 1978 modifiée, vous disposez d''un droit d''accès, de modification, de rectification et de suppression de vos données.</p>
<p>Pour exercer ces droits, contactez-nous à contact@automecanik.com ou par courrier à :</p>
<p>AUTO PIÈCES EQUIPEMENTS<br>184 avenue Aristide Briand<br>93320 Les Pavillons-sous-Bois<br>France</p>',
  true
) ON CONFLICT (alias) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

-- 4. LIV - Modes de Livraison
INSERT INTO ___legal_pages (alias, title, h1, description, keywords, breadcrumb, content, indexable)
VALUES (
  'liv',
  'Modes de Livraison - Automecanik',
  'Modes de Livraison',
  'Découvrez nos modes de livraison : Colissimo, GLS, DHL et points relais. Livraison rapide en France métropolitaine.',
  'livraison, colissimo, GLS, DHL, point relais, automecanik',
  'Livraison',
  '<h2>Nos modes de livraison</h2>
<p>AutoMecaniK.com vous propose plusieurs modes de livraison en fonction de vos besoins : une couverture en France Métropolitaine, des prix bas, traçabilité des expéditions, respect des délais.</p>

<h2>Livraison avec Colissimo</h2>
<p>Colissimo est le service de livraison de La Poste, convient pour les colis de moins de 30kg.</p>
<ul>
<li><strong>Rapidité :</strong> livraison en 24/48H (2 jours ouvrables) après le départ de nos entrepôts</li>
<li><strong>Traçabilité :</strong> suivez votre colis en ligne avec votre n° de colis</li>
</ul>

<h2>Livraison avec GLS</h2>
<p>GLS assure la livraison avec des délais de 24 à 48H.</p>
<ul>
<li><strong>Rapidité :</strong> 24 à 48H (1 à 2 jours ouvrables) après départ</li>
<li><strong>Traçabilité :</strong> suivi continu en ligne</li>
</ul>

<h2>Livraison avec DHL</h2>
<p>DHL est spécialisé dans la livraison partout dans le monde entier avec des services de livraison express.</p>

<h2>Livraison en point relais</h2>
<p>Récupérez votre colis dans le relais le plus proche. Délai de livraison : 24 à 48H après le départ de nos entrepôts.</p>

<h2>Zones de livraison</h2>
<p>Nous livrons en France métropolitaine. Pour la Corse et les DOM-TOM, des frais supplémentaires s''appliquent.</p>',
  true
) ON CONFLICT (alias) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

-- 5. GCRG - Garantie et Retour
INSERT INTO ___legal_pages (alias, title, h1, description, keywords, breadcrumb, content, indexable)
VALUES (
  'gcrg',
  'Garantie et Retour - Automecanik',
  'Garantie et Retour',
  'Politique de garantie et de retour Automecanik : délais, procédures et conditions de remboursement.',
  'garantie, retour, remboursement, échange, automecanik',
  'Garantie et Retour',
  '<h2>Retour produit, échange ou remboursement</h2>
<p>Le client dispose d''un délai de 15 jours à partir de la date de réception de ses produits pour passer une demande de retour, échange ou remboursement.</p>
<p>Pour toute demande de retour, rendez-vous sur votre espace client pour télécharger votre bon de retour.</p>

<h3>Conditions de retour</h3>
<ul>
<li>La pièce doit être en bon état (non utilisée, pas de traces de montage)</li>
<li>La pièce doit être dans son emballage d''origine (ni déchiré, ni scotché)</li>
<li>Joindre le bon de retour signé à l''extérieur du colis</li>
</ul>

<p><strong>Adresse de retour :</strong><br>
AutoMecaniK.com - Service retour<br>
184 avenue Aristide Briand<br>
93320 Les Pavillons-sous-Bois<br>
France</p>

<h2>Retour consigne</h2>
<p>Les pièces en échange standard doivent être retournées dans l''EMBALLAGE D''ORIGINE dans un délai de 30 jours.</p>
<p>Dès réception et vérification, le remboursement sera effectué selon le mode de paiement initial.</p>

<h2>Retour garantie</h2>
<p>Les produits vendus sur AutoMecaniK.com sont généralement garantis un an selon les articles 1641 et suivants du Code civil.</p>
<p>Les pièces retournées sous garantie seront soumises à l''expertise du constructeur.</p>
<p>En cas d''acceptation, le produit défectueux sera réparé ou échangé contre le même produit neuf.</p>

<h2>Délai de remboursement</h2>
<p>AutoMecaniK.com fera tous ses efforts pour rembourser le Client dans un délai de 14 jours à compter de la date de réception du retour.</p>',
  true
) ON CONFLICT (alias) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

-- 6. FAQ - Foire Aux Questions
INSERT INTO ___legal_pages (alias, title, h1, description, keywords, breadcrumb, content, indexable)
VALUES (
  'faq',
  'FAQ - Questions Fréquentes - Automecanik',
  'Foire Aux Questions',
  'Retrouvez les réponses aux questions les plus fréquentes sur Automecanik : recherche pièces, commandes, livraison et retours.',
  'FAQ, questions fréquentes, aide, automecanik',
  'FAQ',
  '<h2>Questions fréquentes</h2>
<p>Vous trouverez ici les questions les plus fréquentes pour rechercher vos pièces compatibles avec votre véhicule et suivre votre commande.</p>

<h3>1. Comment trouver les pièces compatibles avec votre véhicule ?</h3>
<ul>
<li><strong>Recherche par véhicule :</strong> Choisissez la marque, le modèle et le type de motorisation</li>
<li><strong>Recherche par type mine :</strong> Utilisez le type mine de votre carte grise (champs D.2 ou D.2.1)</li>
<li><strong>Recherche par référence :</strong> Si vous avez la référence constructeur ou équipementier</li>
</ul>

<h3>2. Comment effectuer une commande ?</h3>
<ol>
<li>Ajoutez la pièce dans votre panier</li>
<li>Identifiez-vous ou créez un compte</li>
<li>Sélectionnez le mode de livraison et de paiement</li>
<li>Vous recevrez un mail de confirmation et de suivi</li>
</ol>

<h3>3. Comment obtenir des détails sur ma commande ?</h3>
<p>Toutes les informations se trouvent dans votre « espace client ». Vous pouvez suivre l''état d''avancement, télécharger vos factures et gérer vos commandes.</p>

<h3>4. Comment obtenir votre bon de retour ?</h3>
<p>Téléchargez votre bon de retour depuis votre « espace client ». Les bons de retour sont utilisés si la pièce ne se monte pas, est défectueuse ou ne correspond pas.</p>

<h3>5. Comment retourner une pièce consignée ?</h3>
<p>Rendez-vous dans votre « espace client ». Les pièces en échange standard doivent être retournées dans l''emballage d''origine. Le remboursement sera effectué dès réception.</p>',
  true
) ON CONFLICT (alias) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

-- 7. US - À propos / Nos engagements
INSERT INTO ___legal_pages (alias, title, h1, description, keywords, breadcrumb, content, indexable)
VALUES (
  'us',
  'À Propos - Automecanik',
  'Nos Engagements',
  'Découvrez Automecanik : votre spécialiste en pièces détachées automobiles neuves et d''origine. Service client disponible du lundi au vendredi.',
  'à propos, automecanik, pièces auto, engagements',
  'À Propos',
  '<h2>Qui sommes-nous ?</h2>
<p>AUTO PIÈCES EQUIPEMENTS est une société SASU de droit français au capital de 8.000 Euros dont le siège social est situé au 184 avenue Aristide Briand, 93320 Les Pavillons-sous-Bois, France et immatriculée au registre du commerce sous le numéro RCS 820 499 994.</p>

<p>La société AUTO PIÈCES EQUIPEMENTS est spécialisée dans la vente en ligne de pièces et accessoires neuves et d''origine pour le secteur automobile.</p>

<h2>Contactez-nous</h2>
<p>Notre équipe est à votre disposition par téléphone au <strong>01 77 69 58 92</strong> du lundi au vendredi de 08h00 à 18h00 pour :</p>
<ul>
<li>Conseils sur les pièces commandées et leurs compatibilités</li>
<li>Renseignements sur le suivi de votre commande et vos éventuels retours</li>
<li>Toutes informations, des experts sont à votre écoute</li>
</ul>

<h2>Nos engagements</h2>
<p>Pour votre satisfaction, la société Auto MecaniK met en place tous les éléments indispensables pour le bon déroulement de votre commande :</p>
<ul>
<li>Des engagements et accords avec les grands fournisseurs de pièces détachées automobiles</li>
<li>Une infrastructure informatique et logistique adaptée</li>
<li>Services de livraison irréprochables</li>
<li>Modes de paiement avec des plateformes reconnues en termes de sécurité</li>
</ul>',
  true
) ON CONFLICT (alias) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

-- 8. ML - Mentions Légales
INSERT INTO ___legal_pages (alias, title, h1, description, keywords, breadcrumb, content, indexable)
VALUES (
  'ml',
  'Mentions Légales - Automecanik',
  'Mentions Légales',
  'Mentions légales du site Automecanik : informations sur l''éditeur, l''hébergement et la protection des données.',
  'mentions légales, éditeur, automecanik',
  'Mentions Légales',
  '<h2>Éditeur du site</h2>
<p>La société AUTO PIÈCES EQUIPEMENTS est une société SASU de droit français au capital de 8.000 Euros dont le siège social est situé au :</p>
<p><strong>184 avenue Aristide Briand<br>93320 Les Pavillons-sous-Bois<br>France</strong></p>
<p>Immatriculée au registre du commerce sous le numéro <strong>RCS 820 499 994</strong></p>

<h2>Contact</h2>
<ul>
<li><strong>Téléphone :</strong> 01 77 69 58 92</li>
<li><strong>Email :</strong> contact@automecanik.com</li>
<li><strong>Horaires :</strong> Lundi au vendredi de 08h00 à 18h00</li>
</ul>

<h2>Protection des données et respect de la vie privée</h2>
<p>Le propriétaire du site AutoMecaniK.com tient particulièrement à la protection de vos données personnelles et au respect des libertés individuelles conformément à la loi n° 78-17 du 6 janvier 1978 modifiée par la loi du 6 Août 2004.</p>

<p>Vous disposez d''un droit d''accès, de modification, de rectification et de suppression pour toute information vous concernant via :</p>
<ul>
<li>Votre espace personnel</li>
<li>Par téléphone au 01 77 69 58 92</li>
<li>Par courrier à l''adresse ci-dessus</li>
</ul>

<h2>Données bancaires</h2>
<p>Vos données personnelles et bancaires sont recueillies uniquement par l''intermédiaire du formulaire de commande.</p>
<p>Lors du paiement par Carte Bancaire, vous êtes directement dirigé vers le site sécurisé Paybox. Vos informations bancaires ne sont jamais communiquées à notre société.</p>
<p>AUTO PIÈCES EQUIPEMENTS s''engage à protéger les données personnelles et les coordonnées bancaires des clients qui seront cryptées puis transmises de façon sécurisée.</p>',
  true
) ON CONFLICT (alias) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

-- 9. CONTACT - Page Contact
INSERT INTO ___legal_pages (alias, title, h1, description, keywords, breadcrumb, content, indexable)
VALUES (
  'contact',
  'Contact - Automecanik',
  'Contactez-nous',
  'Besoin d''aide ? Contactez Automecanik par téléphone au 01 77 69 58 92 ou par email à contact@automecanik.com.',
  'contact, téléphone, email, automecanik',
  'Contact',
  '<h2>Besoin d''aide ?</h2>
<p>Vous avez des questions sur votre commande ou besoin d''aide ? N''hésitez pas à nous contacter.</p>
<p>Appelez-nous ou envoyez un mail pour que nous puissions répondre à vos besoins.</p>

<h2>Nos coordonnées</h2>
<ul>
<li><strong>Email :</strong> <a href="mailto:contact@automecanik.com">contact@automecanik.com</a></li>
<li><strong>Téléphone :</strong> <a href="tel:+33177695892">01 77 69 58 92</a></li>
<li><strong>Horaires :</strong> Lundi au vendredi de 08h00 à 18h00</li>
</ul>

<h2>Adresse</h2>
<p>AUTO PIÈCES EQUIPEMENTS<br>
184 avenue Aristide Briand<br>
93320 Les Pavillons-sous-Bois<br>
France</p>',
  true
) ON CONFLICT (alias) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

-- 10. COOKIES - Politique de Cookies
INSERT INTO ___legal_pages (alias, title, h1, description, keywords, breadcrumb, content, indexable)
VALUES (
  'cookies',
  'Politique de Cookies - Automecanik',
  'Politique de Cookies',
  'Informations sur l''utilisation des cookies sur le site Automecanik et comment les gérer.',
  'cookies, politique cookies, automecanik',
  'Cookies',
  '<h2>Qu''est-ce qu''un cookie ?</h2>
<p>Un cookie est un petit fichier texte stocké sur votre appareil lors de votre visite sur notre site.</p>

<h2>Utilisation des cookies sur Automecanik</h2>
<p>Le site Auto MecaniK utilise des cookies pour :</p>
<ul>
<li><strong>Vous identifier</strong> lorsque vous vous connectez sur notre site</li>
<li><strong>Fournir des recommandations</strong> sur nos produits</li>
<li><strong>Afficher du contenu personnalisé</strong></li>
<li><strong>Conserver le suivi</strong> des éléments enregistrés dans votre panier de commande</li>
<li><strong>Améliorer la sécurité</strong></li>
</ul>

<h2>Types de cookies</h2>
<h3>Cookies essentiels</h3>
<p>Nécessaires au fonctionnement du site (session, panier, authentification).</p>

<h3>Cookies de performance</h3>
<p>Nous aident à comprendre comment les visiteurs utilisent notre site pour l''améliorer.</p>

<h3>Cookies de fonctionnalité</h3>
<p>Permettent de mémoriser vos préférences et personnaliser votre expérience.</p>

<h2>Gestion des cookies</h2>
<p>Vous pouvez gérer les cookies via les paramètres de votre navigateur. Cependant, la désactivation de certains cookies peut affecter votre expérience sur le site.</p>',
  true
) ON CONFLICT (alias) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

-- Verify inserts
SELECT alias, title, LENGTH(content) as content_length FROM ___legal_pages ORDER BY id;
