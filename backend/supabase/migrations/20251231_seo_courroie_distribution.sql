-- ============================================================================
-- SEO Data: Courroie de distribution (pg_id = 306)
-- ============================================================================
-- G-Level: G1 (Top gamme)
-- URL: /courroie-de-distribution
-- ============================================================================

-- Vérifier si existe déjà et supprimer si nécessaire
DELETE FROM __seo_gamme WHERE sg_pg_id = '306';

-- Insérer les données SEO optimisées
INSERT INTO __seo_gamme (
  sg_pg_id,
  sg_title,
  sg_descrip,
  sg_keywords,
  sg_h1,
  sg_content
) VALUES (
  '306',
  'Courroie de distribution - Pièces auto pas cher | Automecanik',
  'Achetez votre courroie de distribution au meilleur prix. Kit distribution complet, pièces d''origine et adaptables. Livraison gratuite dès 150€. Garantie 2 ans.',
  'courroie de distribution, kit distribution, remplacement courroie, courroie dentée, poulie tendeur, galet tendeur, pompe à eau distribution, kit de distribution complet',
  'Courroie de distribution',
  '<p>La <strong>courroie de distribution</strong> est une pièce essentielle de votre moteur. Elle synchronise le vilebrequin et l''arbre à cames pour assurer le bon fonctionnement des soupapes. Un remplacement préventif tous les 80 000 à 160 000 km évite une casse moteur coûteuse.</p>

<h2>Pourquoi changer sa courroie de distribution ?</h2>
<p>La courroie de distribution s''use naturellement avec le temps et le kilométrage. Une courroie usée ou cassée peut entraîner des dommages irréversibles au moteur (pistons, soupapes, culasse). Le remplacement préventif est donc crucial.</p>

<h2>Kit de distribution complet</h2>
<p>Automecanik vous propose des <strong>kits de distribution complets</strong> incluant :</p>
<ul>
  <li>Courroie de distribution de qualité OE</li>
  <li>Galets tendeurs et enrouleurs</li>
  <li>Pompe à eau (selon les kits)</li>
  <li>Joints et accessoires de montage</li>
</ul>

<h2>Nos garanties</h2>
<ul>
  <li>Pièces conformes aux spécifications constructeur</li>
  <li>Garantie 2 ans sur toutes les pièces</li>
  <li>Livraison gratuite dès 150€</li>
  <li>Service client expert disponible</li>
</ul>

<p>Sélectionnez votre véhicule pour trouver le kit de distribution compatible avec votre modèle.</p>'
);

-- Vérification
SELECT
  sg_pg_id,
  sg_title,
  LENGTH(sg_title) as title_length,
  LENGTH(sg_descrip) as desc_length,
  sg_h1
FROM __seo_gamme
WHERE sg_pg_id = '306';
