/**
 * Client API pour le frontend Remix
 * Configuration centralisée pour les appels vers le backend NestJS
 */

interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};

export type PaginatedResponse<T = any> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

class ApiClient {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    const fullUrl = `${this.config.baseUrl}${endpoint}`;
    console.log('🌐 API Request:', { 
      endpoint, 
      baseUrl: this.config.baseUrl, 
      fullUrl,
      method: options.method || 'GET'
    });

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          ...this.config.headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // === USERS API ===
  
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    users: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);

    return this.request(`/users?${searchParams.toString()}`);
  }

  async getActiveUsers(params?: {
    page?: number;
    limit?: number;
  }): Promise<{
    users: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    return this.request(`/users/active?${searchParams.toString()}`);
  }

  async getUsersByLevel(level: number): Promise<any[]> {
    return this.request(`/users/level/${level}`);
  }

  async getUser(userId: string): Promise<any> {
    return this.request(`/users/${userId}`);
  }

  async getUserByEmail(email: string): Promise<any> {
    return this.request(`/users/email/${email}`);
  }

  async getUserProfile(userId: string): Promise<any> {
    return this.request(`/users/${userId}/profile`);
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tel: string;
    address: string;
    city: string;
    zipCode: string;
    country: string;
    isPro?: boolean;
    level?: number;
  }): Promise<any> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: string, userData: any): Promise<any> {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async updateUserLevel(userId: string, level: number): Promise<any> {
    return this.request(`/users/${userId}/level`, {
      method: 'PATCH',
      body: JSON.stringify({ level }),
    });
  }

  async changePassword(userId: string, passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request(`/users/${userId}/password`, {
      method: 'PATCH',
      body: JSON.stringify(passwordData),
    });
  }

  async deactivateUser(userId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/users/${userId}/deactivate`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  async activateUser(userId: string): Promise<any> {
    return this.request(`/users/${userId}/reactivate`, {
      method: 'PATCH',
    });
  }

  // === ORDERS API ===

  async getOrders(params?: {
    page?: number;
    limit?: number;
    customerId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    orders: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.customerId) searchParams.set('customerId', params.customerId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.set('dateTo', params.dateTo);

    return this.request(`/api/orders?${searchParams.toString()}`);
  }

  async getOrder(orderId: string): Promise<any> {
    return this.request(`/orders/${orderId}`);
  }

  async getOrderComplete(orderId: string): Promise<any> {
    return this.request(`/orders/${orderId}/complete`);
  }

  async getOrdersByCustomer(customerId: string): Promise<any[]> {
    return this.request(`/orders/customer/${customerId}`);
  }

  async createOrder(orderData: any): Promise<any> {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async updateOrder(orderId: string, orderData: any): Promise<any> {
    return this.request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(orderData),
    });
  }

  async updateOrderStatus(orderId: string, status: string, reason?: string): Promise<any> {
    return this.request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  }

  async getOrderStats(): Promise<any> {
    return this.request('/orders/stats/general');
  }

  async getOrderStatsByStatus(): Promise<any> {
    return this.request('/orders/stats/by-status');
  }

  async getOrderStatuses(): Promise<any[]> {
    return this.request('/orders/statuses/orders');
  }

  async getOrderLineStatuses(): Promise<any[]> {
    return this.request('/orders/statuses/lines');
  }

  // === AUTOMOTIVE ORDERS API ===

  async createAutomotiveOrder(orderData: any): Promise<any> {
    return this.request('/automotive-orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getAutomotiveOrder(orderId: string): Promise<any> {
    return this.request(`/automotive-orders/${orderId}`);
  }

  async updateAutomotiveOrderStatus(orderId: string, status: string, reason?: string): Promise<any> {
    return this.request(`/automotive-orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  }

  async validateVehicleData(orderId: string, vehicleData: any): Promise<any> {
    return this.request(`/automotive-orders/${orderId}/validate-vehicle`, {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    });
  }

  async searchAutomotiveOrders(filters: {
    customerId?: string;
    hasVehicleData?: boolean;
    vinNumber?: string;
    registrationNumber?: string;
    oemCode?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    orders: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, value.toString());
      }
    });

    return this.request(`/automotive-orders/search?${searchParams.toString()}`);
  }

  // === VEHICLE DATA API ===

  async validateVIN(vin: string): Promise<any> {
    return this.request('/vehicle-data/validate-vin', {
      method: 'POST',
      body: JSON.stringify({ vin }),
    });
  }

  async validateRegistration(registration: string, country = 'FR'): Promise<any> {
    return this.request('/vehicle-data/validate-registration', {
      method: 'POST',
      body: JSON.stringify({ registration, country }),
    });
  }

  async findEquivalentParts(oemCode: string): Promise<any[]> {
    return this.request(`/vehicle-data/equivalent-parts/${oemCode}`);
  }

  // === TAX CALCULATION API ===

  async calculateOrderTax(taxData: {
    orderId: string;
    country: string;
    customerType: 'individual' | 'professional';
    items: Array<{
      id: string;
      price: number;
      quantity: number;
      category: string;
    }>;
  }): Promise<any> {
    return this.request('/tax-calculation/calculate', {
      method: 'POST',
      body: JSON.stringify(taxData),
    });
  }

  // === SHIPPING CALCULATION API ===

  async calculateShippingFee(shippingData: {
    orderId: string;
    origin: string;
    destination: string;
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    items: Array<{
      id: string;
      weight: number;
      dimensions: {
        length: number;
        width: number;
        height: number;
      };
    }>;
  }): Promise<any> {
    return this.request('/shipping-calculation/calculate', {
      method: 'POST',
      body: JSON.stringify(shippingData),
    });
  }

  // === AUTHENTICATION API ===

  async login(email: string, password: string): Promise<{ user: any; token: string }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tel: string;
    address: string;
    city: string;
    zipCode: string;
    country: string;
  }): Promise<{ user: any; token: string }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<void> {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  async getProfile(): Promise<any> {
    return this.request('/auth/profile');
  }

  async updateProfile(userData: any): Promise<any> {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async refreshToken(): Promise<{ token: string }> {
    return this.request('/auth/refresh', {
      method: 'POST',
    });
  }
}

// Configuration de l'instance API pour le frontend
export const apiClient = new ApiClient({
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-backend.com'
    : 'http://localhost:3000',
  timeout: 10000,
});

export default apiClient;
