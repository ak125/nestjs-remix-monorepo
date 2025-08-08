import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AdminState {
  // État pour la navigation admin
  currentPage: string;
  setCurrentPage: (page: string) => void;
  
  // État pour les notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  }>;
  addNotification: (type: AdminState['notifications'][0]['type'], message: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // État pour les données en cache
  ordersCache: any[];
  setOrdersCache: (orders: any[]) => void;
  clearOrdersCache: () => void;
  
  // État pour le loading global
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAdminStore = create<AdminState>()(
  devtools(
    persist(
  (set, _get) => ({
        // Navigation
        currentPage: 'dashboard',
        setCurrentPage: (page: string) => set({ currentPage: page }),
        
        // Notifications
        notifications: [],
        addNotification: (type, message) => {
          const id = Date.now().toString();
          set(state => ({
            notifications: [
              ...state.notifications,
              { id, type, message, timestamp: Date.now() }
            ]
          }));
        },
        removeNotification: (id: string) => {
          set(state => ({
            notifications: state.notifications.filter(n => n.id !== id)
          }));
        },
        clearNotifications: () => set({ notifications: [] }),
        
        // Cache
        ordersCache: [],
        setOrdersCache: (orders) => set({ ordersCache: orders }),
        clearOrdersCache: () => set({ ordersCache: [] }),
        
        // Loading
        isLoading: false,
        setIsLoading: (loading) => set({ isLoading: loading }),
      }),
      {
        name: 'admin-storage',
        partialize: (state) => ({
          currentPage: state.currentPage,
          // Ne pas persister les notifications et le cache
        }),
      }
    ),
    {
      name: 'admin-store',
    }
  )
);
