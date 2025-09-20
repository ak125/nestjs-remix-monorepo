-- Fonction pour gérer l'adresse de livraison par défaut
-- Assure qu'une seule adresse soit marquée comme défaut par client

CREATE OR REPLACE FUNCTION set_default_delivery_address(
  p_customer_id VARCHAR(50),
  p_address_id INTEGER
) RETURNS VOID AS $$
BEGIN
  -- Retirer le statut par défaut de toutes les adresses du client
  UPDATE ___xtr_customer_delivery_address 
  SET is_default = false 
  WHERE customer_id = p_customer_id;
  
  -- Marquer la nouvelle adresse comme défaut
  UPDATE ___xtr_customer_delivery_address 
  SET is_default = true 
  WHERE id = p_address_id AND customer_id = p_customer_id;
  
  -- Vérifier que l'opération a réussi
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adresse % non trouvée pour le client %', p_address_id, p_customer_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
