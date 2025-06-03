import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import {
    json,
    redirect,
    type ActionFunctionArgs,
    type LoaderFunctionArgs,
} from '@remix-run/node';
import { Form, useActionData, useLoaderData, useNavigation, useParams } from '@remix-run/react';
import { z } from 'zod';
import { Field, TextareaField } from '~/components/forms';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/server/auth.server';
import { createOfferId, getOffer } from '~/server/profile.server';

export const loader = async ({ context, params }: LoaderFunctionArgs) => {
  const offerId = params.offerId;
  if (!offerId) {
    throw new Error("Missing offerId");
  }

  console.log('offerId', offerId);

  const user = await requireUser({ context });

  // Cas où l'ID est "new" (création d'une nouvelle offre)
  if (offerId === "new") {
    return json({
      offer: null,
    });
  }
  
  // Récupération d'une offre existante
  const offer = await getOffer({
    context,
    userId: user.id,
    offerId
  });

  // Redirection si l'offre n'existe pas
  if (!offer) {
    return redirect('/my-services');
  }

  // Retourne l'offre trouvée
  return json({
    offer
  });
};

export const CreateOfferSchema = z.object({
    title: z.string({
        required_error: "Titre est obligatoire.",
    }),
    description: z.string({
        required_error: 'La description est obligatoire',
    }),
    price: z.number({
        required_error: 'Le prix est obligatoire',
    })
    .min(0, 'Le prix doit être supérieur à 0')
    .max(1000, 'Le prix doit être inférieur à 1000'),
});

export const action = async ({ request, context }: ActionFunctionArgs) => {
    const user = await requireUser({ context });
    const formData = await request.formData();
    
    const submission = await parseWithZod(formData, {
        schema: CreateOfferSchema
    });

    if (submission.status !== 'success') {
        return json(
            { result: submission.reply() },
            {
               status: 400,
            }
        );
    }

    const { id: offerId } = await createOfferId({
        context,
        offerData: submission.value,
        userId: user.id,
    });

    return redirect(`/my-services/${offerId}`);
};

export default function CreateOffer() {
    const {offer} = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const [form, fields] = useForm({
        constraint: getZodConstraint(CreateOfferSchema),
        onValidate({ formData }) {
            return parseWithZod(formData, {
                schema: CreateOfferSchema,
            });
        },
        lastResult: actionData?.result,
    });

    const { offerId } = useParams();

    const isLoading = useNavigation().state === 'submitting';

    return (
        <div className='max-w-[600px] mx-auto'>
            <h2 className="text-lg font-bold mb-4">
                {offerId === 'new' ? 'Ajouter une offre' : `Offre ${offerId}`}
            </h2>
            <Form
                {...getFormProps(form)}
                method='POST'
                reloadDocument
                className='flex flex-col gap-2'
            >
                <Field
                    inputProps={getInputProps(fields.title, {
                        type: 'text',
                    })}
                    labelProps={{
                        children: "Titre de l'offre",
                    }}
                    errors={fields.title.errors}
                />

                <Field
                    inputProps={getInputProps(fields.price, {
                        type: 'number',
                    })}
                    labelProps={{
                        children: "Prix de l'offre",
                    }}
                    errors={fields.price.errors}
                />

                <TextareaField
                    textareaProps={getInputProps(fields.description, {
                        type: 'text',
                    })}
                    labelProps={{
                        children: "Description de l'offre",
                    }}
                    errors={fields.description.errors}
                />

                <Button disabled={isLoading} className='ml-auto' type='submit'>
                    Créer cette offre
                </Button>
            </Form>
        </div>
    );
}