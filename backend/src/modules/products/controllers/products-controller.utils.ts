/**
 * Mapper les noms de champs de l'API vers les noms de colonnes en base de données
 */
export function mapSortField(apiField: string): string {
  const fieldMapping: Record<string, string> = {
    name: 'piece_name',
    sku: 'piece_ref',
    price: 'piece_price',
    stock_quantity: 'piece_stock',
    created_at: 'piece_id',
    updated_at: 'piece_id',
  };

  return fieldMapping[apiField] || 'piece_name';
}
