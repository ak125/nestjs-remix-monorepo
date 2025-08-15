import React, { useEffect, createContext, useContext, useState, useCallback } from 'react';

interface NotificationProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
}

interface NotificationContextType {
  notifications: NotificationProps[];
  addNotification: (type: NotificationProps['type'], message: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

  const addNotification = useCallback((type: NotificationProps['type'], message: string) => {
    const id = Date.now().toString();
    const notification: NotificationProps = {
      id,
      type,
      message,
      timestamp: Date.now(),
    };
    setNotifications(prev => [...prev, notification]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

const NotificationItem: React.FC<NotificationProps> = ({ id, type, message }) => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('NotificationItem must be used within NotificationProvider');
  
  const { removeNotification } = context;

  useEffect(() => {
    const timer = setTimeout(() => {
      removeNotification(id);
    }, 5000); // Auto-remove après 5 secondes

    return () => clearTimeout(timer);
  }, [id, removeNotification]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  return (
    <div className={`border rounded-lg p-4 shadow-sm transition-all duration-300 ${getTypeStyles()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-semibold">{getIcon()}</span>
          <span className="text-sm">{message}</span>
        </div>
        <button
          onClick={() => removeNotification(id)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Fermer la notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export const NotificationContainer: React.FC = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('NotificationContainer must be used within NotificationProvider');
  
  const { notifications } = context;

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} {...notification} />
      ))}
    </div>
  );
};

// Hook pour faciliter l'utilisation des notifications
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  
  const { addNotification, clearNotifications } = context;

  return {
    showSuccess: (message: string) => addNotification('success', message),
    showError: (message: string) => addNotification('error', message),
    showWarning: (message: string) => addNotification('warning', message),
    showInfo: (message: string) => addNotification('info', message),
    clearAll: clearNotifications,
  };
};
