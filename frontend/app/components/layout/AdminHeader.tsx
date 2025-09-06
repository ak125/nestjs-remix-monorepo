/**
 * 🏢 ADMIN HEADER - Header spécialisé pour l'administration
 * 
 * Basé sur le Header principal avec configuration admin
 */

import { Header } from './Header';

interface AdminHeaderProps {
  className?: string;
  showStats?: boolean;
}

export function AdminHeader({ className, showStats: _showStats = true }: AdminHeaderProps) {
  return (
    <Header 
      context="admin"
      variant="simple"
      theme="default"
      className={className}
    />
  );
}
