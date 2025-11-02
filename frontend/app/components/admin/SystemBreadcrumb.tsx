/**
 * 🍞 COMPOSANT FIL D'ARIANE - Navigation contextuelle
 * 
 * Composant de navigation en fil d'Ariane pour le système de configuration
 * - Navigation hiérarchique intuitive
 * - Indicateurs de statut par niveau
 * - Actions rapides contextuelles
 * - Responsive et accessible
 */

import { Link, useLocation } from '@remix-run/react';
import { 
  ChevronRight, 
  Home, 
  Settings, 
  Database, 
  BarChart3, 
  Mail, 
  Shield,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowLeft
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  status?: 'healthy' | 'warning' | 'error' | 'unknown';
  isActive?: boolean;
  isDropdown?: boolean;
  dropdownItems?: BreadcrumbDropdownItem[];
}

interface BreadcrumbDropdownItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  status?: 'healthy' | 'warning' | 'error' | 'unknown';
  description?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  environment?: string;
  onEnvironmentChange?: (env: string) => void;
  moduleStatuses?: Record<string, 'healthy' | 'warning' | 'error'>;
  showActions?: boolean;
  customActions?: React.ReactNode;
}

// Configuration des modules avec leurs icônes et routes
const MODULE_CONFIG = {
  'system-config': {
    label: 'Configuration Système',
    icon: Settings,
    color: 'blue',
    description: 'Paramètres globaux du système'
  },
  'database': {
    label: 'Base de Données',
    icon: Database,
    color: 'blue',
    description: 'Configuration des connexions BDD'
  },
  'analytics': {
    label: 'Analytics',
    icon: BarChart3,
    color: 'green',
    description: 'Tracking et mesures d\'audience'
  },
  'email': {
    label: 'Email',
    icon: Mail,
    color: 'purple',
    description: 'Configuration des services email'
  },
  'security': {
    label: 'Sécurité',
    icon: Shield,
    color: 'red',
    description: 'Politiques et paramètres de sécurité'
  }
};

const ENVIRONMENTS = [
  { value: 'development', label: 'Développement', color: 'gray' },
  { value: 'staging', label: 'Staging', color: 'yellow' },
  { value: 'production', label: 'Production', color: 'green' }
];

export default function SystemBreadcrumb({
  items: customItems,
  environment = 'production',
  onEnvironmentChange,
  moduleStatuses = {},
  showActions = true,
  customActions
}: BreadcrumbProps) {
  const location = useLocation();
  const [isEnvironmentDropdownOpen, setIsEnvironmentDropdownOpen] = useState(false);
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);

  // Génération automatique du fil d'Ariane basé sur l'URL
  const generateBreadcrumbItems = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];

    // Élément racine - Accueil Admin
    items.push({
      label: 'Administration',
      href: '/admin',
      icon: Home,
      status: 'healthy'
    });

    // Analyser les segments de chemin
    pathSegments.forEach((segment, index) => {
      const isLast = index === pathSegments.length - 1;
      
      if (segment === 'admin') {
        // Déjà géré comme élément racine
        return;
      }

      if (segment === 'system-config') {
        const moduleDropdownItems: BreadcrumbDropdownItem[] = Object.entries(MODULE_CONFIG).map(([key, config]) => ({
          label: config.label,
          href: `/admin/system-config?module=${key}&environment=${environment}`,
          icon: config.icon,
          status: moduleStatuses[key] || 'unknown',
          description: config.description
        }));

        items.push({
          label: 'Configuration Système',
          href: isLast ? undefined : '/admin/system-config',
          icon: Settings,
          status: calculateOverallStatus(Object.values(moduleStatuses)),
          isActive: isLast,
          isDropdown: true,
          dropdownItems: moduleDropdownItems
        });
      } else if (MODULE_CONFIG[segment as keyof typeof MODULE_CONFIG]) {
        const moduleConfig = MODULE_CONFIG[segment as keyof typeof MODULE_CONFIG];
        items.push({
          label: moduleConfig.label,
          href: isLast ? undefined : `/admin/system-config?module=${segment}&environment=${environment}`,
          icon: moduleConfig.icon,
          status: moduleStatuses[segment] || 'unknown',
          isActive: isLast
        });
      } else {
        // Segment générique
        items.push({
          label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
          href: isLast ? undefined : `/${pathSegments.slice(0, index + 1).join('/')}`,
          isActive: isLast
        });
      }
    });

    return items;
  };

  const breadcrumbItems = customItems || generateBreadcrumbItems();

  // Calculer le statut global
  const calculateOverallStatus = (statuses: string[]): 'healthy' | 'warning' | 'error' | 'unknown' => {
    if (statuses.includes('error')) return 'error';
    if (statuses.includes('warning')) return 'warning';
    if (statuses.includes('healthy')) return 'healthy';
    return 'unknown';
  };

  // Obtenir la couleur du statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-l-4 border-success bg-success/10';
      case 'warning':
        return 'border-l-4 border-warning bg-warning/10';
      case 'error':
        return 'border-l-4 border-destructive bg-destructive/10';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Obtenir l'icône du statut
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return CheckCircle;
      case 'warning':
        return AlertCircle;
      case 'error':
        return XCircle;
      default:
        return AlertCircle;
    }
  };

  // Fermer les dropdowns quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = () => {
      setIsEnvironmentDropdownOpen(false);
      setIsModuleDropdownOpen(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Fil d'Ariane principal */}
        <nav className="flex items-center space-x-2" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            {breadcrumbItems.map((item, index) => {
              const isLast = index === breadcrumbItems.length - 1;
              const ItemIcon = item.icon;
              const StatusIcon = item.status ? getStatusIcon(item.status) : null;

              return (
                <li key={index} className="flex items-center">
                  {index > 0 && (
                    <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                  )}
                  
                  <div className="flex items-center space-x-2">
                    {item.isDropdown ? (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsModuleDropdownOpen(!isModuleDropdownOpen);
                          }}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            item.isActive
                              ? 'text-blue-700 bg-primary/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          {ItemIcon && <ItemIcon className="h-4 w-4" />}
                          <span>{item.label}</span>
                          {item.status && StatusIcon && (
                            <StatusIcon className={`h-4 w-4 ${getStatusColor(item.status).split(' ')[0]}`} />
                          )}
                          <ChevronRight className={`h-4 w-4 transition-transform ${isModuleDropdownOpen ? 'rotate-90' : ''}`} />
                        </button>

                        {/* Dropdown des modules */}
                        {isModuleDropdownOpen && item.dropdownItems && (
                          <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                            <div className="py-2">
                              {item.dropdownItems.map((dropdownItem, dropdownIndex) => {
                                const DropdownIcon = dropdownItem.icon;
                                const DropdownStatusIcon = dropdownItem.status ? getStatusIcon(dropdownItem.status) : null;

                                return (
                                  <Link
                                    key={dropdownIndex}
                                    to={dropdownItem.href}
                                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                                    onClick={() => setIsModuleDropdownOpen(false)}
                                  >
                                    <div className="flex items-center space-x-3">
                                      {DropdownIcon && <DropdownIcon className="h-5 w-5 text-gray-400" />}
                                      <div>
                                        <div className="font-medium text-gray-900">{dropdownItem.label}</div>
                                        {dropdownItem.description && (
                                          <div className="text-gray-500 text-xs">{dropdownItem.description}</div>
                                        )}
                                      </div>
                                    </div>
                                    {dropdownItem.status && DropdownStatusIcon && (
                                      <DropdownStatusIcon className={`h-4 w-4 ${getStatusColor(dropdownItem.status).split(' ')[0]}`} />
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : item.href && !isLast ? (
                      <Link
                        to={item.href}
                        className="flex items-center space-x-2 px-2 py-1 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                      >
                        {ItemIcon && <ItemIcon className="h-4 w-4" />}
                        <span>{item.label}</span>
                        {item.status && StatusIcon && (
                          <StatusIcon className={`h-4 w-4 ${getStatusColor(item.status).split(' ')[0]}`} />
                        )}
                      </Link>
                    ) : (
                      <div className={`flex items-center space-x-2 px-2 py-1 rounded-md text-sm font-medium ${
                        isLast ? 'text-gray-900 bg-gray-100' : 'text-gray-600'
                      }`}>
                        {ItemIcon && <ItemIcon className="h-4 w-4" />}
                        <span>{item.label}</span>
                        {item.status && StatusIcon && (
                          <StatusIcon className={`h-4 w-4 ${getStatusColor(item.status).split(' ')[0]}`} />
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Actions et sélecteur d'environnement */}
        {showActions && (
          <div className="flex items-center space-x-4">
            {/* Actions personnalisées */}
            {customActions}

            {/* Sélecteur d'environnement */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEnvironmentDropdownOpen(!isEnvironmentDropdownOpen);
                }}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className={`w-2 h-2 rounded-full ${
                  environment === 'production' ? 'bg-success' :
                  environment === 'staging' ? 'bg-warning' : 'bg-gray-500'
                }`} />
                <span className="capitalize">
                  {ENVIRONMENTS.find(env => env.value === environment)?.label || environment}
                </span>
                <ChevronRight className={`h-4 w-4 transition-transform ${isEnvironmentDropdownOpen ? 'rotate-90' : ''}`} />
              </button>

              {/* Dropdown des environnements */}
              {isEnvironmentDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    {ENVIRONMENTS.map((env) => (
                      <button
                        key={env.value}
                        onClick={() => {
                          onEnvironmentChange?.(env.value);
                          setIsEnvironmentDropdownOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                          environment === env.value ? 'bg-primary/10 text-primary' : 'text-gray-700'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full bg-${env.color}-500`} />
                        <span>{env.label}</span>
                        {environment === env.value && (
                          <CheckCircle className="h-4 w-4 text-blue-600 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bouton retour */}
            <button
              onClick={() => window.history.back()}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
              title="Retour"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
