# 🎯 INSTRUCTIONS COPILOT MCP - SUPABASE

## 📋 CONTEXTE MCP SUPABASE
Ce guide contient les instructions spécialisées pour GitHub Copilot lors du développement avec Supabase dans l'architecture MCP Context-7.

## 🏗️ CONFIGURATION SUPABASE MCP

### Configuration Client Supabase
```typescript
/**
 * MCP GENERATED CONFIG
 * Généré automatiquement par MCP Context-7
 * Module: supabase
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

### Types Supabase générés
```typescript
/**
 * MCP GENERATED TYPES
 * Généré automatiquement par MCP Context-7
 * Module: supabase-types
 */
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          title: string;
          content: string | null;
          published: boolean;
          author_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content?: string | null;
          published?: boolean;
          author_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string | null;
          published?: boolean;
          author_id?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
```

## 🔧 SERVICE SUPABASE MCP

### Service Supabase pour NestJS
```typescript
/**
 * MCP GENERATED SERVICE
 * Généré automatiquement par MCP Context-7
 * Module: supabase
 */
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types/supabase.types';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient<Database>;
  private supabaseAdmin: SupabaseClient<Database>;

  constructor() {
    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );

    this.supabaseAdmin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  // Get client for user operations
  getClient(): SupabaseClient<Database> {
    return this.supabase;
  }

  // Get admin client for privileged operations
  getAdminClient(): SupabaseClient<Database> {
    return this.supabaseAdmin;
  }

  // Auth helpers
  async signUp(email: string, password: string, metadata?: any) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      return {
        status: 'error',
        error: error.message,
        module: 'supabase-auth',
      };
    }

    return {
      status: 'success',
      data,
      module: 'supabase-auth',
    };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        status: 'error',
        error: error.message,
        module: 'supabase-auth',
      };
    }

    return {
      status: 'success',
      data,
      module: 'supabase-auth',
    };
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      return {
        status: 'error',
        error: error.message,
        module: 'supabase-auth',
      };
    }

    return {
      status: 'success',
      message: 'Signed out successfully',
      module: 'supabase-auth',
    };
  }

  // Database helpers
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  }
}
```

### Module Supabase
```typescript
/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: supabase
 */
import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
```

## 🎯 PATTERNS MCP AVEC SUPABASE

### 1. Repository Pattern
```typescript
/**
 * MCP GENERATED REPOSITORY
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 */
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Database } from '../supabase/types/supabase.types';

type {ModelName}Row = Database['public']['Tables']['{table_name}']['Row'];
type {ModelName}Insert = Database['public']['Tables']['{table_name}']['Insert'];
type {ModelName}Update = Database['public']['Tables']['{table_name}']['Update'];

@Injectable()
export class {ModuleName}Repository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(data: {ModelName}Insert) {
    const supabase = this.supabaseService.getClient();
    
    const { data: result, error } = await supabase
      .from('{table_name}')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result;
  }

  async findMany(params: {
    page?: number;
    limit?: number;
    filter?: Partial<{ModelName}Row>;
    search?: string;
    orderBy?: keyof {ModelName}Row;
    ascending?: boolean;
  } = {}) {
    const supabase = this.supabaseService.getClient();
    const { 
      page = 1, 
      limit = 10, 
      filter = {}, 
      search, 
      orderBy = 'created_at',
      ascending = false 
    } = params;

    let query = supabase
      .from('{table_name}')
      .select('*', { count: 'exact' });

    // Apply filters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        query = query.eq(key, value);
      }
    });

    // Apply search
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply ordering
    query = query.order(orderBy as string, { ascending });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return {
      data: data || [],
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async findById(id: string) {
    const supabase = this.supabaseService.getClient();
    
    const { data, error } = await supabase
      .from('{table_name}')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: string, data: {ModelName}Update) {
    const supabase = this.supabaseService.getClient();
    
    const { data: result, error } = await supabase
      .from('{table_name}')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result;
  }

  async delete(id: string) {
    const supabase = this.supabaseService.getClient();
    
    const { error } = await supabase
      .from('{table_name}')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }

  // Real-time subscription
  subscribeToChanges(callback: (payload: any) => void) {
    const supabase = this.supabaseService.getClient();
    
    return supabase
      .channel('{table_name}_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: '{table_name}',
        },
        callback,
      )
      .subscribe();
  }
}
```

### 2. Service avec Repository
```typescript
/**
 * MCP GENERATED SERVICE
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { {ModuleName}Repository } from './{module-name}.repository';
import { {ModuleName}Dto } from './dto/{module-name}.dto';

@Injectable()
export class {ModuleName}Service {
  constructor(private readonly repository: {ModuleName}Repository) {}

  async create(dto: {ModuleName}Dto) {
    try {
      const result = await this.repository.create({
        ...dto,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return {
        status: 'success',
        data: result,
        module: '{module-name}',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        module: '{module-name}',
      };
    }
  }

  async findAll(query: any = {}) {
    try {
      const result = await this.repository.findMany(query);

      return {
        status: 'success',
        data: result.data,
        meta: result.meta,
        module: '{module-name}',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        module: '{module-name}',
      };
    }
  }

  async findOne(id: string) {
    try {
      const result = await this.repository.findById(id);

      if (!result) {
        throw new NotFoundException(`{ModuleName} with ID ${id} not found`);
      }

      return {
        status: 'success',
        data: result,
        module: '{module-name}',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        module: '{module-name}',
      };
    }
  }

  async update(id: string, dto: {ModuleName}Dto) {
    try {
      const result = await this.repository.update(id, dto);

      return {
        status: 'success',
        data: result,
        module: '{module-name}',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        module: '{module-name}',
      };
    }
  }

  async remove(id: string) {
    try {
      await this.repository.delete(id);

      return {
        status: 'success',
        message: `{ModuleName} with ID ${id} deleted successfully`,
        module: '{module-name}',
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        module: '{module-name}',
      };
    }
  }

  // Real-time method
  subscribeToChanges(callback: (payload: any) => void) {
    return this.repository.subscribeToChanges(callback);
  }
}
```

## 🔐 AUTHENTIFICATION SUPABASE

### Auth Guard pour NestJS
```typescript
/**
 * MCP GENERATED GUARD
 * Généré automatiquement par MCP Context-7
 * Module: supabase-auth
 */
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const supabase = this.supabaseService.getClient();
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

## 🎨 INTÉGRATION REMIX

### Hook Supabase pour Remix
```typescript
/**
 * MCP GENERATED HOOK
 * Généré automatiquement par MCP Context-7
 * Module: supabase-remix
 */
import { useEffect, useState } from 'react';
import { supabase } from '~/lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useSupabaseQuery<T>(
  table: string,
  query?: {
    select?: string;
    filter?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
  },
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        let supabaseQuery = supabase.from(table).select(query?.select || '*');

        if (query?.filter) {
          Object.entries(query.filter).forEach(([key, value]) => {
            supabaseQuery = supabaseQuery.eq(key, value);
          });
        }

        if (query?.orderBy) {
          supabaseQuery = supabaseQuery.order(
            query.orderBy.column,
            { ascending: query.orderBy.ascending ?? true },
          );
        }

        const { data, error } = await supabaseQuery;

        if (error) {
          setError(error.message);
        } else {
          setData(data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [table, JSON.stringify(query)]);

  return { data, loading, error };
}
```

## 🎯 INSTRUCTIONS COPILOT

Quand tu génères du code Supabase pour l'architecture MCP :

1. **TOUJOURS** inclure le header MCP avec le nom du module
2. **UTILISER** les types générés depuis la base Supabase
3. **IMPLÉMENTER** le pattern Repository pour l'abstraction des données
4. **GÉRER** les erreurs Supabase avec try/catch et retours MCP standardisés
5. **AJOUTER** la pagination et les filtres dans les queries
6. **UTILISER** les fonctionnalités real-time quand approprié
7. **SÉCURISER** avec Row Level Security (RLS) et les auth guards
8. **OPTIMISER** les queries avec select spécifique et indexation

### Exemple complet d'utilisation :
Si l'utilisateur demande "Crée un module products avec Supabase", tu dois générer :
- Types TypeScript depuis le schema Supabase
- ProductRepository avec toutes les méthodes CRUD et real-time
- ProductService utilisant le repository
- Auth guard pour sécuriser les endpoints
- Hooks Remix pour l'intégration frontend
- Gestion des erreurs et réponses MCP standardisées

Cette approche garantit une intégration robuste avec Supabase dans l'architecture MCP Context-7 tout en conservant la flexibilité du real-time et de l'authentification.
