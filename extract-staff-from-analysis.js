const fs = require('fs');
const path = require('path');

// Lire l'analyse PHP existante
const analysisPath = '/workspaces/TEMPLATE_MCP_COMPLETE/php-analysis/orders-complete-analysis.json';
const businessLogicPath = '/workspaces/TEMPLATE_MCP_COMPLETE/php-analysis/orders-business-logic.json';

async function extractStaffLogic() {
  try {
    console.log('🔍 Extraction de la logique Staff depuis l\'analyse PHP...');
    
    // Lire les fichiers d'analyse
    const completeAnalysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
    const businessLogic = JSON.parse(fs.readFileSync(businessLogicPath, 'utf8'));
    
    // Extraire les informations sur ___config_admin
    const staffQueries = [];
    const staffFields = new Set();
    const staffTables = new Set();
    
    // Analyser les requêtes SQL
    [completeAnalysis, businessLogic].forEach(analysis => {
      analysis.analysis.forEach(file => {
        if (file.sqlQueries && file.sqlQueries.queries) {
          file.sqlQueries.queries.forEach(query => {
            if (query.table === '___config_admin' || query.table === '___CONFIG_ADMIN') {
              staffQueries.push({
                file: file.file,
                query: query.query,
                type: query.type,
                fields: query.fields || [],
                conditions: query.conditions || []
              });
              
              staffTables.add(query.table);
              if (query.fields) {
                query.fields.forEach(field => staffFields.add(field));
              }
            }
          });
        }
      });
    });
    
    // Extraire les champs depuis les requêtes SQL
    const fieldPatterns = [
      /CNFA_(\w+)/g,
      /cnfa_(\w+)/g
    ];
    
    staffQueries.forEach(query => {
      fieldPatterns.forEach(pattern => {
        const matches = query.query.matchAll(pattern);
        for (const match of matches) {
          staffFields.add(`cnfa_${match[1].toLowerCase()}`);
        }
      });
    });
    
    // Analyser les niveaux d'accès
    const accessLevels = [];
    staffQueries.forEach(query => {
      if (query.query.includes('CNFA_LEVEL') || query.query.includes('cnfa_level')) {
        const levelMatch = query.query.match(/level.*?([0-9]+)/i);
        if (levelMatch) {
          accessLevels.push(parseInt(levelMatch[1]));
        }
      }
    });
    
    // Résultat de l'analyse
    const staffAnalysis = {
      moduleName: 'staff',
      timestamp: new Date().toISOString(),
      basedOnAnalysis: ['orders-complete-analysis.json', 'orders-business-logic.json'],
      tables: {
        primary: '___config_admin',
        related: ['___xtr_customer', '___xtr_order']
      },
      fields: Array.from(staffFields).sort(),
      queriesFound: staffQueries.length,
      accessLevels: [...new Set(accessLevels)].sort(),
      businessLogic: {
        authentication: {
          loginField: 'cnfa_login',
          passwordField: 'cnfa_pswd',
          keylogField: 'cnfa_keylog',
          activeField: 'cnfa_activ'
        },
        authorization: {
          levelField: 'cnfa_level',
          levels: {
            7: 'Administrateur Commercial',
            8: 'Administrateur Avancé',
            9: 'Super-Administrateur'
          }
        },
        commonQueries: [
          {
            purpose: 'Authentication',
            pattern: "SELECT * FROM ___config_admin WHERE cnfa_login = ? AND cnfa_keylog = ?",
            fields: ['cnfa_login', 'cnfa_keylog', 'cnfa_activ']
          },
          {
            purpose: 'Authorization Check',
            pattern: "SELECT cnfa_level FROM ___config_admin WHERE cnfa_login = ? AND cnfa_activ = '1'",
            fields: ['cnfa_level', 'cnfa_activ']
          },
          {
            purpose: 'Staff Management',
            pattern: "SELECT * FROM ___config_admin WHERE cnfa_activ = '1' ORDER BY cnfa_level DESC",
            fields: ['*']
          }
        ]
      },
      sampleQueries: staffQueries.slice(0, 5)
    };
    
    // Sauvegarder l'analyse staff
    const outputPath = '/workspaces/TEMPLATE_MCP_COMPLETE/php-analysis/staff-analysis.json';
    fs.writeFileSync(outputPath, JSON.stringify(staffAnalysis, null, 2));
    
    console.log('✅ Analyse Staff terminée !');
    console.log(`📄 Fichier généré : ${outputPath}`);
    console.log(`📊 Résumé :`);
    console.log(`   - Tables trouvées : ${Array.from(staffTables).join(', ')}`);
    console.log(`   - Champs identifiés : ${staffFields.size}`);
    console.log(`   - Requêtes analysées : ${staffQueries.length}`);
    console.log(`   - Niveaux d'accès : ${accessLevels.length > 0 ? accessLevels.join(', ') : 'Aucun spécifique'}`);
    
    return staffAnalysis;
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'extraction :', error);
    throw error;
  }
}

// Fonction pour générer les services NestJS
function generateNestJSService(analysis) {
  const serviceTemplate = `import { Injectable } from '@nestjs/common';
import { SupabaseRestService } from '../database/supabase-rest.service';
import { CacheService } from '../cache/cache.service';
import * as bcrypt from 'bcryptjs';

export interface StaffMember {
  id: string;
  login: string;
  email: string;
  level: number;
  job: string;
  name: string;
  firstName: string;
  phone: string;
  isActive: boolean;
  keylog: string;
  departmentId: string;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly supabaseRestService: SupabaseRestService,
    private readonly cacheService: CacheService,
  ) {}

  async findAll(): Promise<StaffMember[]> {
    console.log('🔍 StaffService.findAll');
    
    try {
      const { data } = await this.supabaseRestService.supabase
        .from('___config_admin')
        .select('*')
        .eq('cnfa_activ', '1')
        .order('cnfa_level', { ascending: false });
      
      return data?.map(this.mapToStaffMember) || [];
    } catch (error) {
      console.error('❌ Erreur findAll staff:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<StaffMember | null> {
    console.log('🔍 StaffService.findById:', id);
    
    try {
      const { data } = await this.supabaseRestService.supabase
        .from('___config_admin')
        .select('*')
        .eq('cnfa_id', id)
        .eq('cnfa_activ', '1')
        .single();
      
      return data ? this.mapToStaffMember(data) : null;
    } catch (error) {
      console.error('❌ Erreur findById staff:', error);
      return null;
    }
  }

  async findByLogin(login: string): Promise<StaffMember | null> {
    console.log('🔍 StaffService.findByLogin:', login);
    
    try {
      const { data } = await this.supabaseRestService.supabase
        .from('___config_admin')
        .select('*')
        .eq('cnfa_login', login)
        .eq('cnfa_activ', '1')
        .single();
      
      return data ? this.mapToStaffMember(data) : null;
    } catch (error) {
      console.error('❌ Erreur findByLogin staff:', error);
      return null;
    }
  }

  async create(staffData: Partial<StaffMember>): Promise<StaffMember> {
    console.log('🔧 StaffService.create:', staffData);
    
    try {
      const hashedPassword = await bcrypt.hash(staffData.password || 'TempPassword123!', 10);
      const keylog = \`STAFF_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
      
      const { data } = await this.supabaseRestService.supabase
        .from('___config_admin')
        .insert([{
          cnfa_login: staffData.login,
          cnfa_pswd: hashedPassword,
          cnfa_mail: staffData.email,
          cnfa_keylog: keylog,
          cnfa_level: staffData.level || 7,
          cnfa_job: staffData.job || 'Administrateur',
          cnfa_name: staffData.name,
          cnfa_fname: staffData.firstName,
          cnfa_tel: staffData.phone,
          cnfa_activ: '1',
          s_id: staffData.departmentId || 'ADM'
        }])
        .select()
        .single();
      
      return this.mapToStaffMember(data);
    } catch (error) {
      console.error('❌ Erreur create staff:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<StaffMember>): Promise<StaffMember> {
    console.log('🔧 StaffService.update:', id, updates);
    
    try {
      const updateData: any = {};
      
      if (updates.email) updateData.cnfa_mail = updates.email;
      if (updates.level) updateData.cnfa_level = updates.level;
      if (updates.job) updateData.cnfa_job = updates.job;
      if (updates.name) updateData.cnfa_name = updates.name;
      if (updates.firstName) updateData.cnfa_fname = updates.firstName;
      if (updates.phone) updateData.cnfa_tel = updates.phone;
      if (updates.isActive !== undefined) updateData.cnfa_activ = updates.isActive ? '1' : '0';
      
      const { data } = await this.supabaseRestService.supabase
        .from('___config_admin')
        .update(updateData)
        .eq('cnfa_id', id)
        .select()
        .single();
      
      return this.mapToStaffMember(data);
    } catch (error) {
      console.error('❌ Erreur update staff:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('🗑️ StaffService.delete:', id);
    
    try {
      await this.supabaseRestService.supabase
        .from('___config_admin')
        .update({ cnfa_activ: '0' })
        .eq('cnfa_id', id);
    } catch (error) {
      console.error('❌ Erreur delete staff:', error);
      throw error;
    }
  }

  private mapToStaffMember(data: any): StaffMember {
    return {
      id: data.cnfa_id,
      login: data.cnfa_login,
      email: data.cnfa_mail,
      level: parseInt(data.cnfa_level) || 7,
      job: data.cnfa_job,
      name: data.cnfa_name,
      firstName: data.cnfa_fname,
      phone: data.cnfa_tel,
      isActive: data.cnfa_activ === '1',
      keylog: data.cnfa_keylog,
      departmentId: data.s_id
    };
  }
}
`;
  
  return serviceTemplate;
}

// Exécuter l'extraction
if (require.main === module) {
  extractStaffLogic()
    .then(analysis => {
      console.log('\n📁 Génération du service NestJS...');
      const service = generateNestJSService(analysis);
      
      const servicePath = '/workspaces/TEMPLATE_MCP_COMPLETE/nestjs-remix-monorepo/backend/src/staff/staff.service.ts';
      fs.writeFileSync(servicePath, service);
      
      console.log('✅ Service généré :', servicePath);
    })
    .catch(console.error);
}

module.exports = { extractStaffLogic, generateNestJSService };
