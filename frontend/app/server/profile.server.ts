import { type AppLoadContext } from '@remix-run/node';
import { type CreateOfferSchema } from "~/routes/_public+/my-services.$offerId";
import { z } from 'zod';

// Fonction pour récupérer toutes les offres d'un utilisateur
export const getUserOffers = async ({ userId, context }: { context: AppLoadContext; userId: string }) => {
    return await context.remixService.prisma.offer.findMany({
        select: {
            id: true,
            title: true,
            description: true,
            price: true,
            updatedAt: true,
            userId: true,
            active: true,
            recurring: true,
        },
        where: {
            userId,
        },
    });
};

// Fonction pour créer une offre
export const createOfferId = async ({ context, offerData, userId }: {
     context: AppLoadContext;
     offerData: z.infer<typeof CreateOfferSchema>;
     userId: string;
}) => {
    return await context.remixService.prisma.offer.create({
        data: {
            title: offerData.title,
            description: offerData.description,
            price: offerData.price,
            user: {
                connect: {
                    id: userId
                }
            }
        },
        select: {
            id: true
        }
    });
};

// Fonction pour récupérer une offre spécifique par son ID
export const getOffer = async ({ userId, context, offerId }: { 
    context: AppLoadContext; 
    userId: string; 
    offerId: string 
}) => {
    return await context.remixService.prisma.offer.findUnique({
        select: {
            id: true,
            title: true,
            description: true,
            price: true,
            updatedAt: true,
            userId: true,
            active: true,
            recurring: true,
        },
        where: {
            id: offerId,
            userId,
        },
    });
};