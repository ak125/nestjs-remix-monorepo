/**
 * 🍞 useToast Hook - Toast notifications simples et performantes
 * 
 * Feedback visuel instantané pour les actions utilisateur
 * Sans dépendance externe, ultra-léger
 */

import { useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

export function useToast() {
  const show = useCallback((options: ToastOptions) => {
    const { message, type = 'success', duration = 3000 } = options;
    
    // ⚡ Créer et afficher le toast de façon non-bloquante
    requestAnimationFrame(() => {
      const toast = document.createElement('div');
      toast.className = getToastClasses(type);
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        animation: slideInRight 0.2s ease-out;
        pointer-events: auto;
        cursor: pointer;
      `;
      
      // Ajouter au DOM
      document.body.appendChild(toast);
      
      // Supprimer automatiquement
      const timeoutId = setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.2s ease-in';
        setTimeout(() => toast.remove(), 200);
      }, duration);
      
      // Supprimer au clic
      toast.addEventListener('click', () => {
        clearTimeout(timeoutId);
        toast.style.animation = 'slideOutRight 0.2s ease-in';
        setTimeout(() => toast.remove(), 200);
      });
    });
  }, []);
  
  const success = useCallback((message: string, duration?: number) => {
    show({ message, type: 'success', duration });
  }, [show]);
  
  const error = useCallback((message: string, duration?: number) => {
    show({ message, type: 'error', duration });
  }, [show]);
  
  const info = useCallback((message: string, duration?: number) => {
    show({ message, type: 'info', duration });
  }, [show]);
  
  return { show, success, error, info };
}

function getToastClasses(type: ToastType): string {
  const baseClasses = 'flex items-center gap-2';
  
  switch (type) {
    case 'success':
      return `${baseClasses} bg-emerald-500 text-white`;
    case 'error':
      return `${baseClasses} bg-red-500 text-white`;
    case 'info':
      return `${baseClasses} bg-blue-500 text-white`;
    default:
      return `${baseClasses} bg-gray-800 text-white`;
  }
}

// Ajouter les animations CSS au montage
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
