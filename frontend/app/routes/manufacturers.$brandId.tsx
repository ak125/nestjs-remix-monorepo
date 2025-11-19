/**
 * 🔀 REDIRECT: /manufacturers/:id → /brands/:id
 * 
 * Cette route redirige vers /brands pour préserver le SEO
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  const { brandId } = params;
  return redirect(`/brands/${brandId}`, 301);
}

export default function ManufacturerBrandRedirect() {
  return null;
}

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <PublicBreadcrumb items={[
        { label: "Marques", href: "/manufacturers" },
        { label: brand?.marque_name || `Marque #${params.brandId}` }
      ]} />
      
      {/* Header avec logo de marque */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          {brand && (
            <div className="w-16 h-16">
              <BrandLogoClient
                logoPath={null} // L'API ne retourne pas logoPath pour l'instant
                brandName={brand.marque_name}
              />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {brand?.marque_name || `Marque #${params.brandId}`}
            </h1>
            <p className="text-gray-600 mt-1">
              {models.length} modèles disponibles
            </p>
          </div>
        </div>
        
        <Link to="/manufacturers">
          <Button variant="outline" className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Retour aux marques</span>
          </Button>
        </Link>
      </div>

      {error && (
        <Alert intent="error"><strong>Erreur :</strong> {error}</Alert>
      )}

      {/* Section Modèles */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 flex items-center">
          <Car className="h-6 w-6 mr-2 text-blue-600" />
          Modèles {brand?.marque_name}
        </h2>
        
        {models.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map((model) => (
              <Card key={model.modele_id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-primary/5 rounded-lg">
                      <Car className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      model.modele_year_to 
                        ? 'bg-gray-100 text-gray-700' 
                        : 'bg-success/15 text-green-700'
                    }`}>
                      {model.modele_year_to ? 'Ancien' : 'Actuel'}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-2">{model.modele_name}</h3>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <p className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {model.modele_year_from}
                      {model.modele_year_to ? ` - ${model.modele_year_to}` : ' - Actuel'}
                    </p>
                    <p className="flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      {model.modele_body}
                    </p>
                  </div>

                  {model.modele_alias && (
                    <p className="text-sm text-gray-500 mt-2">
                      Alias: {model.modele_alias}
                    </p>
                  )}
                  
                  {/* Navigation vers les motorisations */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <Link to={`/manufacturers/${params.brandId}/models/${model.modele_id}/types`}>
                      <Button variant="outline" size="sm" className="w-full">
                        <Settings className="h-4 w-4 mr-2" />
                        Voir motorisations
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Car className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Aucun modèle disponible</p>
          </div>
        )}
      </div>

      {/* Section Motorisations (si disponible) */}
      {types && types.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-6 flex items-center">
            <Settings className="h-6 w-6 mr-2 text-green-600" />
            Motorisations disponibles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {types.map((type) => (
              <Card key={type.id}>
                <CardContent className="p-4">
                  <h3 className="font-medium text-lg">{type.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {type.engine_code} - {type.fuel_type} - {type.power_hp}cv
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
