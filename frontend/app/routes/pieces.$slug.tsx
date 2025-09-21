import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";

interface LoaderData {
  status: number;
  meta?: {
    title: string;
    description: string;
    keywords: string;
    robots: string;
    canonical: string;
    relfollow: number;
  };
  content?: {
    h1: string;
    content: string;
    pg_name: string;
    pg_alias: string;
    pg_pic: string;
    pg_wall: string;
  };
  sections?: {
    conseils: Array<{
      id: number;
      title: string;
      content: string;
    }>;
    informations: string[];
  };
  catalogueFiltres?: Array<{
    id: string;
    name: string;
    alias: string;
    image: string;
    link: string;
  }>;
  motorisations?: Array<{
    title: string;
    motorisation: string;
    puissance: string;
    description: string;
    advice: string;
  }>;
  equipementiers?: Array<{
    pm_id: string;
    pm_name: string;
    pm_logo: string;
    description: string;
  }>;
  error?: string;
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || data.status !== 200) {
    return [{ title: "Pièce non trouvée" }];
  }

  return [
    { title: data.meta.title },
    { name: "description", content: data.meta.description },
    { name: "keywords", content: data.meta.keywords },
    { name: "robots", content: data.meta.robots },
    { name: "canonical", content: data.meta.canonical },
  ];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const slug = params.slug;
  
  if (!slug) {
    throw new Response('Not Found', { status: 404 });
  }
  
  // Extract gamme ID from slug (format: "name-id.html")
  const match = slug.match(/^(.+)-(\d+)\.html$/);
  if (!match) {
    throw new Response('Not Found', { status: 404 });
  }
  
  const gammeId = match[2];
  
  try {
    const response = await fetch(`http://localhost:3000/api/gamme-rest/${gammeId}/page-data`);
    const data = await response.json();
    
    // Check if page exists and is accessible
    if (data.status === 404 || data.status === 410) {
      throw new Response('Gamme not found', { status: 404 });
    }
    
    if (data.status === 412) {
      throw new Response('Page disabled', { status: 404 });
    }
    
    if (data.status === 301 && data.redirect) {
      throw new Response('', { 
        status: 301, 
        headers: { Location: data.redirect } 
      });
    }
    
    return json(data);
  } catch (error) {
    console.error('Error fetching gamme data:', error);
    throw new Response('Internal Server Error', { status: 500 });
  }
}

export default function PiecePage() {
  const data = useLoaderData<LoaderData>();
  
  if (data.status !== 200 || !data.content) {
    return <div>Erreur lors du chargement</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec titre principal */}
      <header className="bg-blue-600 text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">{data.content.h1}</h1>
          <nav className="mt-2 text-sm">
            <Link to="/" className="hover:underline">Automecanik</Link>
            <span className="mx-2">&gt;</span>
            <span>{data.content.pg_name}</span>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Contenu principal */}
        <section className="bg-white rounded-lg shadow-md mb-8">
          <div className="p-6">
            <div className="text-gray-600 mb-4">
              <span>Informations sur les {data.content.pg_name}</span>
            </div>
            <div 
              className="prose max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: data.content.content.replace(/\n/g, '<br>') }} 
            />
          </div>
        </section>

        {/* Section Conseils */}
        {data.sections?.conseils && data.sections.conseils.length > 0 && (
          <section className="bg-white rounded-lg shadow-md mb-8">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Conseils sur les {data.content.pg_name}
              </h2>
              {data.sections.conseils.map((conseil) => (
                <div key={conseil.id} className="mb-6 last:mb-0">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    {conseil.id}. {conseil.title}
                  </h3>
                  <div 
                    className="text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: conseil.content.replace(/\n/g, '<br>') }} 
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section Informations */}
        {data.sections?.informations && data.sections.informations.length > 0 && (
          <section className="bg-white rounded-lg shadow-md mb-8">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Informations sur les {data.content.pg_name}
              </h2>
              <div className="text-gray-700 leading-relaxed">
                {data.sections.informations.map((info, index) => (
                  <div key={index} className="mb-2">
                    - {info}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Catalogue des Filtres */}
        {data.catalogueFiltres && data.catalogueFiltres.length > 0 && (
          <section className="bg-white rounded-lg shadow-md mb-8">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Catalogue {data.content.pg_name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.catalogueFiltres.map((filtre) => (
                  <Link
                    key={filtre.id}
                    to={filtre.link}
                    className="bg-gray-50 rounded-lg p-4 hover:bg-blue-50 transition-colors duration-200 border border-gray-200 hover:border-blue-300"
                  >
                    <div className="flex items-center space-x-3">
                      {filtre.image && (
                        <img 
                          src={`/upload/articles/gammes-produits/catalogue/${filtre.image}`}
                          alt={filtre.name}
                          className="w-16 h-16 object-cover rounded"
                          onError={(e) => {
                            e.currentTarget.src = '/images/placeholder.webp';
                          }}
                        />
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-800">{filtre.name}</h3>
                        <p className="text-sm text-gray-600">Voir la gamme complète</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Motorisations Populaires */}
        {data.motorisations && data.motorisations.length > 0 && (
          <section className="bg-white rounded-lg shadow-md mb-8">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Motorisations populaires pour {data.content.pg_name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.motorisations.map((motorisation, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-lg text-blue-600 mb-2">
                      {motorisation.title}
                    </h3>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      {motorisation.motorisation} - {motorisation.puissance}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      {motorisation.description}
                    </p>
                    <p className="text-xs text-blue-500 italic">
                      {motorisation.advice}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Équipementiers */}
        {data.equipementiers && data.equipementiers.length > 0 && (
          <section className="bg-white rounded-lg shadow-md mb-8">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Équipementiers {data.content.pg_name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {data.equipementiers.map((equipementier) => (
                  <div key={equipementier.pm_id} className="text-center border border-gray-200 rounded-lg p-4">
                    {equipementier.pm_logo && (
                      <div className="mb-4">
                        <img 
                          src={`/upload/equipementiers-automobiles/${equipementier.pm_logo}`}
                          alt={equipementier.pm_name}
                          className="w-full h-20 object-contain mx-auto"
                          onError={(e) => {
                            e.currentTarget.src = '/images/placeholder.webp';
                          }}
                        />
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-800 mb-2">
                      {equipementier.pm_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {equipementier.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-lg font-bold mb-2">Automecanik.com</h3>
          <p className="text-sm mb-1">Pièces détachées automobile pas cher</p>
          <p className="text-xs text-gray-400">
            Le site de vente en ligne de pièces auto au meilleur prix
          </p>
        </div>
      </footer>
    </div>
  );
}