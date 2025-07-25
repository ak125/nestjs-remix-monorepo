import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Form } from '@remix-run/react';
import { z } from 'zod';
import { Field } from '~/components/forms';
import { Button } from '~/components/ui/button';
import { getOptionalUser } from "~/server/auth.server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
    const user = await getOptionalUser({ context })
    if (user) {
        return redirect('/admin/dashboard')
    }
    return null;
};

// Le formulaire poste directement vers l'endpoint NestJS
// Pas besoin d'action Remix, NestJS gère tout

const LoginSchema = z.object({
    username: z // NestJS attend 'username'
        .string({ required_error: "L'email est obligatoire." })
        .email({ message: 'Cet email est invalide.' }),
    password: z.string({ required_error: 'Le mot de passe est obligatoire.' }),
});

export default function Login() {
    const [form, fields] = useForm({
        constraint: getZodConstraint(LoginSchema),
        onValidate({ formData }) {
            return parseWithZod(formData, {
                schema: LoginSchema,
            });
        },
    });

    return (
        <div className='max-w-[600px] mx-auto'>
            <h1>Connexion</h1>
            <Form
                {...getFormProps(form)}
                method='POST'
                action='/authenticate' // Direct vers l'endpoint NestJS
                className='flex flex-col gap-4'
            >
                <Field
                    inputProps={getInputProps(fields.username, {
                        type: 'email',
                    })}
                    labelsProps={{
                        children: 'Adresse e-mail',
                    }}
                    errors={fields.username.errors}
                />

                <Field
                    inputProps={getInputProps(fields.password, {
                        type: 'password',
                    })}
                    labelsProps={{
                        children: 'Mot de passe',
                    }}
                    errors={fields.password.errors}
                />

                <Button className='ml-auto' type='submit'>
                    Se connecter
                </Button>
            </Form>
        </div>
    );
}
