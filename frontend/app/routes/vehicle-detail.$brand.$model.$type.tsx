// 🚗 Page détail véhicule - Version indépendante sans conflit de routes
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import React from 'react';

// 📝 Types de données (reprises du PHP)
interface VehicleData {
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;
  marque_logo: string;
  marque_relfollow: number;
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_name_meta: string;
  modele_relfollow: number;
  type_id: number;
  type_alias: string;
  type_name: string;
  type_name_meta: string;
  type_power_ps: string;
  type_body: string;
  type_fuel: string;
  type_month_from: string;
  type_year_from: string;
  type_month_to: string | null;
  type_year_to: string | null;
  type_relfollow: number;
}

interface LoaderData {
  vehicle: VehicleData;
  testMessage: string;
}

// 🔄 Loader simplifié au maximum
export async function loader({ params, request }: LoaderFunctionArgs) {
  console.log('🚨🚨🚨 LOADER VEHICLE-DETAIL APPELÉ 🚨🚨🚨');
  console.log('🔄 Params:', params);
  console.log('🔄 URL:', request.url);
  
  const { brand, model, type } = params;
  if (!brand || !model || !type) {
    throw new Response("Paramètres manquants", { status: 400 });
  }

  const vehicleData: VehicleData = {
    marque_id: 47,
    marque_alias: brand.split('-')[0],
    marque_name: "DACIA",
    marque_name_meta: "DACIA",
    marque_name_meta_title: "DACIA",
    marque_logo: "dacia.webp",
    marque_relfollow: 1,
    modele_id: 47014,
    modele_alias: "duster",
    modele_name: "DUSTER",
    modele_name_meta: "DUSTER",
    modele_relfollow: 1,
    type_id: 33041,
    type_alias: "type",
    type_name: "TYPE",
    type_name_meta: "TYPE",
    type_power_ps: "90",
    type_body: "Berline",
    type_fuel: "Diesel",
    type_month_from: "1",
    type_year_from: "2010",
    type_month_to: null,
    type_year_to: null,
    type_relfollow: 1
  };

  console.log('✅ Données créées, retour du JSON');
  
  return json<LoaderData>({
    vehicle: vehicleData,
    testMessage: "SUCCESS - Route indépendante fonctionne !"
  });
}

// 🎨 Composant ultra simple
export default function VehicleDetailIndependent() {
  console.log('🚗 DEBUT COMPOSANT INDEPENDANT');
  
  try {
    const data = useLoaderData<typeof loader>();
    console.log('🔍 Data reçue:', data);
    
    return (
      <div style={{ 
        padding: '50px', 
        backgroundColor: 'green', 
        color: 'white',
        minHeight: '100vh',
        fontSize: '18px'
      }}>
        <h1 style={{ 
          backgroundColor: 'darkgreen', 
          padding: '20px', 
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          🚗 ROUTE INDÉPENDANTE FONCTIONNE !
        </h1>
        
        <div style={{ backgroundColor: 'white', color: 'black', padding: '20px', marginBottom: '20px' }}>
          <h2>Message de test</h2>
          <p>{data.testMessage}</p>
        </div>

        <div style={{ backgroundColor: 'white', color: 'black', padding: '20px' }}>
          <h2>Données véhicule</h2>
          <p><strong>Marque:</strong> {data.vehicle.marque_name}</p>
          <p><strong>Modèle:</strong> {data.vehicle.modele_name}</p>
          <p><strong>Type:</strong> {data.vehicle.type_name}</p>
          <p><strong>Puissance:</strong> {data.vehicle.type_power_ps} ch</p>
        </div>
      </div>
    );

  } catch (error) {
    console.error('💥 ERREUR:', error);
    return (
      <div style={{ backgroundColor: 'red', color: 'white', padding: '50px' }}>
        💥 ERREUR: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }
}