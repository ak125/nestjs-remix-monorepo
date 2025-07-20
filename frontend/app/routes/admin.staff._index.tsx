import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  try {
    console.log('🔍 Chargement des utilisateurs via service intégré...');
    
    // Vérification de la présence du service d'intégration
    if (!context.remixService?.integration) {
      throw new Error('Service d\'intégration Remix non disponible dans le contexte');
    }
    
    console.log('✅ Utilisation du service d\'intégration direct - Performance optimale');
    const result = await context.remixService.integration.getUsersForRemix({
      page: 1,
      limit: 50
    });
    
    if (!result.success) {
      throw new Error(`Erreur du service d'intégration: ${result.error || 'Erreur inconnue'}`);
    }
    
    console.log(`✅ ${result.users?.length || 0} utilisateurs récupérés sur ${result.total || 0} au total`);
    
    // Transformer les données pour l'interface staff
    const staff = (result.users || []).map((user: any) => ({
      id: user.id || user.cst_id,
      email: user.email || user.cst_mail,
      firstName: user.firstName || user.cst_fname || 'N/A',
      lastName: user.lastName || user.cst_name || 'N/A',
      role: (user.isPro !== undefined ? user.isPro : user.cst_is_pro === '1') ? 'Professionnel' : 'Particulier',
      isActive: user.isActive !== undefined ? user.isActive : user.cst_activ === '1',
      lastLogin: new Date().toISOString(), // Placeholder - pas disponible dans les données actuelles
      level: user.level || user.cst_level || 0,
      civility: user.civility || user.cst_civility || '',
      address: user.address || user.cst_address || '',
      city: user.city || user.cst_city || '',
      zipCode: user.zipCode || user.cst_zip_code || '',
      phone: user.tel || user.cst_tel || '',
      mobile: user.mobile || user.cst_gsm || '',
    }));

    return json({ 
      staff, 
      total: result.total || staff.length,
      success: true
    });
    
  } catch (error) {
    console.error('❌ Erreur dans le loader du personnel:', error);
    
    // En cas d'erreur, retourner une structure vide mais cohérente
    return json({ 
      staff: [], 
      total: 0, 
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      success: false
    });
  }
};

type LoaderData = {
  staff: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    lastLogin: string;
    level: number;
    civility: string;
    address: string;
    city: string;
    zipCode: string;
    phone: string;
    mobile: string;
  }>;
  total: number;
  error?: string;
  success: boolean;
};

export default function AdminStaffIndex() {
  const { staff, total, error, success } = useLoaderData<LoaderData>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion du Personnel</h1>
          <p className="text-sm text-gray-500">
            Total: {total} utilisateurs
            {success && (
              <span className="ml-2 text-green-600 font-medium">(Service intégré)</span>
            )}
          </p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => window.location.reload()} 
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            Actualiser
          </button>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
            Nouveau Membre
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erreur du service intégré</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {staff.map((member) => (
            <li key={member.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div>
                      <p className="text-sm font-medium text-indigo-600">
                        {member.civility && `${member.civility} `}
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                      <p className="text-sm text-gray-500">
                        {member.role} (Niveau {member.level})
                      </p>
                      {member.address && (
                        <p className="text-sm text-gray-400">
                          {member.address}, {member.zipCode} {member.city}
                        </p>
                      )}
                      {(member.phone || member.mobile) && (
                        <p className="text-sm text-gray-400">
                          {member.phone && `Tél: ${member.phone}`}
                          {member.phone && member.mobile && ' • '}
                          {member.mobile && `Mobile: ${member.mobile}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      member.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {member.isActive ? 'Actif' : 'Inactif'}
                    </span>
                    <button className="text-indigo-600 hover:text-indigo-900 text-sm">
                      Modifier
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    ID: {member.id}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      
      {staff.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucun membre du personnel trouvé</p>
        </div>
      )}
    </div>
  );
}
