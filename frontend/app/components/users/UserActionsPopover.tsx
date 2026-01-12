/**
 * UserActionsPopover - Menu d'actions contextuelles pour les utilisateurs
 *
 * @features
 * - Actions rapides : Éditer, Voir profil, Envoyer message
 * - Actions de modération : Bloquer, Supprimer
 * - Icônes colorées par type d'action
 * - Séparateurs visuels entre groupes d'actions
 * - Callbacks personnalisables pour chaque action
 *
 * @example
 * <UserActionsPopover
 *   user={user}
 *   onEdit={() => navigate(`/admin/users/${user.id}/edit`)}
 *   onDelete={() => handleDelete(user.id)}
 * >
 *   <Button variant="ghost" size="icon">
 *     <MoreVertical />
 *   </Button>
 * </UserActionsPopover>
 */

import { Edit, Eye, Mail, Ban, Trash2, MoreVertical } from "lucide-react";
import { type ReactNode } from "react";

import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export interface UserForActions {
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  isBlocked?: boolean;
}

interface UserActionsPopoverProps {
  /** Utilisateur concerné */
  user: UserForActions;
  /** Callback éditer */
  onEdit?: () => void;
  /** Callback voir profil */
  onViewProfile?: () => void;
  /** Callback envoyer message */
  onSendMessage?: () => void;
  /** Callback bloquer/débloquer */
  onToggleBlock?: () => void;
  /** Callback supprimer */
  onDelete?: () => void;
  /** Element déclencheur du popover */
  children?: ReactNode;
  /** Afficher l'action éditer */
  showEdit?: boolean;
  /** Afficher l'action voir profil */
  showViewProfile?: boolean;
  /** Afficher l'action message */
  showMessage?: boolean;
  /** Afficher l'action bloquer */
  showBlock?: boolean;
  /** Afficher l'action supprimer */
  showDelete?: boolean;
  /** Position du popover */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignement du popover */
  align?: "start" | "center" | "end";
}

export function UserActionsPopover({
  user,
  onEdit,
  onViewProfile,
  onSendMessage,
  onToggleBlock,
  onDelete,
  children,
  showEdit = true,
  showViewProfile = true,
  showMessage = true,
  showBlock = true,
  showDelete = true,
  side = "bottom",
  align = "end",
}: UserActionsPopoverProps) {
  const handleAction = (callback?: () => void, closePopover?: () => void) => {
    callback?.();
    closePopover?.();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children || (
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-600 hover:text-gray-900"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-64 p-2">
        <div className="space-y-1">
          {/* Header avec nom utilisateur */}
          <div className="px-3 py-2 text-sm font-semibold text-gray-900">
            Actions pour {user.firstName} {user.lastName}
          </div>

          {/* Actions principales */}
          {(showEdit || showViewProfile || showMessage) && (
            <div className="space-y-1">
              {showEdit && onEdit && (
                <Button
                  variant="ghost"
                  onClick={() => handleAction(onEdit)}
                  className="flex w-full items-center justify-start gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Edit className="h-4 w-4 text-blue-600" />
                  <span>Éditer</span>
                </Button>
              )}

              {showViewProfile && onViewProfile && (
                <Button
                  variant="ghost"
                  onClick={() => handleAction(onViewProfile)}
                  className="flex w-full items-center justify-start gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                >
                  <Eye className="h-4 w-4 text-purple-600" />
                  <span>Voir profil</span>
                </Button>
              )}

              {showMessage && onSendMessage && (
                <Button
                  variant="ghost"
                  onClick={() => handleAction(onSendMessage)}
                  className="flex w-full items-center justify-start gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700"
                >
                  <Mail className="h-4 w-4 text-green-600" />
                  <span>Envoyer un message</span>
                </Button>
              )}
            </div>
          )}

          {/* Séparateur */}
          {(showEdit || showViewProfile || showMessage) &&
            (showBlock || showDelete) && (
              <div className="my-2 border-t border-gray-200" />
            )}

          {/* Actions de modération */}
          {(showBlock || showDelete) && (
            <div className="space-y-1">
              {showBlock && onToggleBlock && (
                <Button
                  variant="ghost"
                  onClick={() => handleAction(onToggleBlock)}
                  className="flex w-full items-center justify-start gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700"
                >
                  <Ban className="h-4 w-4 text-orange-600" />
                  <span>{user.isBlocked ? "Débloquer" : "Bloquer"}</span>
                </Button>
              )}

              {showDelete && onDelete && (
                <Button
                  variant="ghost"
                  onClick={() => handleAction(onDelete)}
                  className="flex w-full items-center justify-start gap-3 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <span>Supprimer</span>
                </Button>
              )}
            </div>
          )}

          {/* Footer avec email */}
          <div className="mt-2 border-t border-gray-200 pt-2">
            <div className="px-3 py-1 text-xs text-gray-500">{user.email}</div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
