import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useParams } from "@remix-run/react";
import { buttonVariants } from "../components/ui/button";
import { formatDate, formatPrice } from "../lib/utils";
import { getOffer } from "../server/offers.server";

export const loader = async ({ params, context }: LoaderFunctionArgs) => {
  const offerId = params.offerId;
  if (!offerId) {
    throw new Error("Missing offerId");
  }
  
  try {
    // Appel à la version Prisma
    const foundOffer = await getOffer({ offerId, context });
    
    if (!foundOffer) {
      throw new Error(`Offer not found for ID: ${offerId}`);
    }
    
    return json({ offer: foundOffer });
  } catch (error) {
    console.error("Error fetching offer:", error);
    throw new Error(`Unable to load offer: ${offerId}`);
  }
};

export default function OfferDetails() {
  const { offer } = useLoaderData<typeof loader>();
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{offer.title}</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/2">
            <img 
              src="https://via.placeholder.com/600x400" 
              alt={offer.title}
              className="w-full h-auto rounded-md"
            />
          </div>
          <div className="w-full md:w-1/2">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xl font-bold text-blue-600">{formatPrice({ price: offer.price })}/h</p>
              <p className="text-gray-600">{offer.place}</p>
            </div>
            <p className="text-gray-700 mb-6">{offer.description}</p>
            <p className="text-sm text-gray-500">Publié le {formatDate({ date: offer.datepublished })}</p>
            <div className="mt-8">
              <button className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700">
                Réserver maintenant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ErrorBoundary = () => {
  const { offerId } = useParams();
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Oups !</h1>
      <p className="mb-4">
        Une erreur est survenue lors de la récupération de l'annonce. 
        <span className="font-bold"> L'offre "{offerId}" n'existe pas.</span>
      </p>
      <Link 
        to="/offers" 
        className={buttonVariants({ variant: "primary" })}
      >
        Retourner à la liste des offres
      </Link>
    </div>
  );
};