import { AuthenticationException } from '@common/exceptions';

/**
 * Identifiant de l'utilisateur de la session : client concerné ou auteur d'une
 * action. Une session sans identifiant est refusée (401) plutôt que de laisser
 * la requête agir sans auteur ou sur les données de tous les clients.
 */
export function requireSessionUserId(req: {
  user?: { id?: string | number | null };
}): string {
  const id = req.user?.id;
  if (id === undefined || id === null || String(id) === '') {
    throw new AuthenticationException({ message: 'Non authentifié' });
  }
  return String(id);
}
