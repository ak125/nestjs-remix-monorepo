import { Outlet } from '@remix-run/react';
import { Bell, Settings, User, ChevronDown } from 'lucide-react';
import { DynamicMenu } from '../components/ui/DynamicMenu';
import { useUser } from '../hooks/useUser';

export default function CommercialLayout() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Interface Commerciale
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="h-5 w-5" />
            </button>
            
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="h-5 w-5" />
            </button>
            
            <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-[calc(100vh-4rem)] sticky top-16">
          <div className="p-4">
            <DynamicMenu 
              module="commercial" 
              className="space-y-1"
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Default Commercial Dashboard */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Tableau de Bord Commercial
                </h2>
                <p className="text-gray-600 mt-1">
                  Gérez vos commandes, clients et performances commerciales
                </p>
              </div>
              
              <div className="p-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-600 text-sm font-medium">Commandes du jour</p>
                        <p className="text-2xl font-bold text-blue-900">27</p>
                      </div>
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">📋</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-600 text-sm font-medium">CA du mois</p>
                        <p className="text-2xl font-bold text-green-900">€45,230</p>
                      </div>
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 font-semibold">💰</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-600 text-sm font-medium">En attente</p>
                        <p className="text-2xl font-bold text-orange-900">12</p>
                      </div>
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 font-semibold">⏳</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-blue-600">📝</span>
                    </div>
                    <h3 className="font-medium text-gray-900">Nouvelle Commande</h3>
                    <p className="text-sm text-gray-600 mt-1">Créer une commande client</p>
                  </button>
                  
                  <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-green-600">👥</span>
                    </div>
                    <h3 className="font-medium text-gray-900">Gestion Clients</h3>
                    <p className="text-sm text-gray-600 mt-1">Ajouter ou modifier clients</p>
                  </button>
                  
                  <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-purple-600">📊</span>
                    </div>
                    <h3 className="font-medium text-gray-900">Rapports</h3>
                    <p className="text-sm text-gray-600 mt-1">Analyser les performances</p>
                  </button>
                  
                  <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-red-600">🔍</span>
                    </div>
                    <h3 className="font-medium text-gray-900">Suivi Commandes</h3>
                    <p className="text-sm text-gray-600 mt-1">Suivre l'état des commandes</p>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Nested Routes Content */}
            <div className="mt-6">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
