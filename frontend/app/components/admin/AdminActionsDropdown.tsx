/**
 * ⚡ Admin Actions Dropdown - Menu d'actions contextuelles
 * 
 * Menu dropdown pour actions rapides sur les éléments admin
 * (commandes, produits, utilisateurs, etc.)
 * 
 * Features:
 * - Actions contextuelles par type d'élément
 * - Icônes colorées par action
 * - Séparateurs entre groupes d'actions
 * - Support actions destructives
 * - Raccourcis clavier affichés
 */

import { Link } from '@remix-run/react';
import {
  CheckCircle,
  Copy,
  Edit,
  Eye,
  MoreVertical,
  Printer,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface AdminAction {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  shortcut?: string;
  disabled?: boolean;
}

interface AdminActionsDropdownProps {
  /** Titre du menu (optionnel) */
  label?: string;
  /** Liste des actions disponibles */
  actions: AdminAction[];
  /** Taille du trigger button */
  size?: 'sm' | 'md' | 'lg';
  /** Afficher le trigger en mode icône seule */
  iconOnly?: boolean;
}

export function AdminActionsDropdown({
  label = 'Actions',
  actions,
  size = 'md',
  iconOnly = true,
}: AdminActionsDropdownProps) {
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3',
  };

  const getVariantClasses = (variant?: string) => {
    switch (variant) {
      case 'success':
        return 'text-green-600 hover:text-green-700 hover:bg-green-50';
      case 'warning':
        return 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50';
      case 'destructive':
        return 'text-red-600 hover:text-red-700 hover:bg-red-50';
      default:
        return 'hover:bg-gray-100';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`${sizeClasses[size]} hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        {iconOnly ? (
          <MoreVertical className="w-5 h-5 text-gray-600" />
        ) : (
          <span className="text-sm font-medium">{label}</span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="end">
        {label && !iconOnly && <DropdownMenuLabel>{label}</DropdownMenuLabel>}

        <DropdownMenuGroup>
          {actions.map((action, index) => {
            const isLastInGroup =
              index === actions.length - 1 ||
              actions[index + 1]?.variant === 'destructive';

            return (
              <div key={index}>
                {action.href ? (
                  <DropdownMenuItem asChild disabled={action.disabled}>
                    <Link
                      to={action.href}
                      className={`flex items-center cursor-pointer ${getVariantClasses(action.variant)}`}
                    >
                      {action.icon && <span className="mr-2">{action.icon}</span>}
                      <span>{action.label}</span>
                      {action.shortcut && (
                        <DropdownMenuShortcut>
                          {action.shortcut}
                        </DropdownMenuShortcut>
                      )}
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`cursor-pointer ${getVariantClasses(action.variant)}`}
                  >
                    {action.icon && <span className="mr-2">{action.icon}</span>}
                    <span>{action.label}</span>
                    {action.shortcut && (
                      <DropdownMenuShortcut>
                        {action.shortcut}
                      </DropdownMenuShortcut>
                    )}
                  </DropdownMenuItem>
                )}
                {isLastInGroup && index !== actions.length - 1 && (
                  <DropdownMenuSeparator />
                )}
              </div>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 📦 Presets d'actions courantes
 */
export const adminActionPresets = {
  /** Actions pour une commande */
  order: (orderId: string, callbacks: {
    onView?: () => void;
    onEdit?: () => void;
    onPrint?: () => void;
    onValidate?: () => void;
    onCancel?: () => void;
  }): AdminAction[] => [
    {
      label: 'Voir détails',
      icon: <Eye className="w-4 h-4" />,
      href: `/admin/orders/${orderId}`,
      shortcut: '⌘V',
    },
    {
      label: 'Modifier',
      icon: <Edit className="w-4 h-4" />,
      onClick: callbacks.onEdit,
      shortcut: '⌘E',
    },
    {
      label: 'Imprimer',
      icon: <Printer className="w-4 h-4" />,
      onClick: callbacks.onPrint,
      shortcut: '⌘P',
    },
    {
      label: 'Valider',
      icon: <CheckCircle className="w-4 h-4" />,
      onClick: callbacks.onValidate,
      variant: 'success',
    },
    {
      label: 'Annuler',
      icon: <XCircle className="w-4 h-4" />,
      onClick: callbacks.onCancel,
      variant: 'destructive',
    },
  ],

  /** Actions pour un produit */
  product: (productId: string, callbacks: {
    onEdit?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
  }): AdminAction[] => [
    {
      label: 'Voir la fiche',
      icon: <Eye className="w-4 h-4" />,
      href: `/products/${productId}`,
    },
    {
      label: 'Modifier',
      icon: <Edit className="w-4 h-4" />,
      onClick: callbacks.onEdit,
      shortcut: '⌘E',
    },
    {
      label: 'Dupliquer',
      icon: <Copy className="w-4 h-4" />,
      onClick: callbacks.onDuplicate,
    },
    {
      label: 'Supprimer',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: callbacks.onDelete,
      variant: 'destructive',
    },
  ],

  /** Actions pour un utilisateur */
  user: (userId: string, callbacks: {
    onEdit?: () => void;
    onSendEmail?: () => void;
    onBlock?: () => void;
    onDelete?: () => void;
  }): AdminAction[] => [
    {
      label: 'Voir le profil',
      icon: <Eye className="w-4 h-4" />,
      href: `/admin/users/${userId}`,
    },
    {
      label: 'Modifier',
      icon: <Edit className="w-4 h-4" />,
      onClick: callbacks.onEdit,
    },
    {
      label: 'Envoyer un email',
      icon: <Send className="w-4 h-4" />,
      onClick: callbacks.onSendEmail,
    },
    {
      label: 'Bloquer',
      icon: <XCircle className="w-4 h-4" />,
      onClick: callbacks.onBlock,
      variant: 'warning',
    },
    {
      label: 'Supprimer',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: callbacks.onDelete,
      variant: 'destructive',
    },
  ],
};
