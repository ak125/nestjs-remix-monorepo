/**
 * MCP GENERATED COMPONENT
 * Généré automatiquement par MCP Context-7
 * Source: welcome.php
 */

import { json, LoaderFunction, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export const meta: MetaFunction = () => {
  return [
    { title: 'Tableau de bord' },
    { name: 'robots', content: 'noindex, nofollow' }
  ];
};

export const loader: LoaderFunction = async ({ request }) => {
  // Validation de session via API
  const response = await fetch('/api/welcome/validate', {
    headers: { 
      'Cookie': request.headers.get('Cookie') || '' 
    }
  });

  const authResult = await response.json();
  
  return json({
    authResult,
    domainName: process.env.DOMAIN_NAME || 'Mon Application'
  });
};

export default function Welcome() {
  const { authResult, domainName } = useLoaderData<typeof loader>();

  if (!authResult.accessRequest) {
    return (
      <div className="access-denied">
        <h1>Accès refusé</h1>
        <p>Statut: {authResult.destinationLinkMsg}</p>
      </div>
    );
  }

  return (
    <div className="welcome-page">
      <div className="container-fluid Page-Welcome-Title">
        <h1>{domainName}</h1>
        <h2>Bienvenu sur votre tableau de bord</h2>
      </div>
      
      <div className="container-fluid Page-Welcome-Box">
        <div className="row text-center w-100">
          <br />
          <br />
          <b>
            Cliquez sur l'icone menu en haut à gauche de votre écran 
            pour accéder à votre liste de gestion.
          </b>
        </div>
      </div>
    </div>
  );
}
