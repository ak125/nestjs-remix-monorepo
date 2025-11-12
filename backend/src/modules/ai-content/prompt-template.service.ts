import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  CreatePromptTemplateDto,
  UpdatePromptTemplateDto,
  PromptTemplate,
} from './dto/prompt-template.dto';
import { createHash } from 'crypto';

@Injectable()
export class PromptTemplateService {
  private readonly logger = new Logger(PromptTemplateService.name);
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates() {
    // Add some default templates
    const defaultTemplates: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Description Produit Standard',
        description: 'Template pour générer des descriptions de produits standards',
        category: 'product',
        systemPrompt: 'Tu es un expert en rédaction de fiches produits e-commerce.',
        userPromptTemplate: `Crée une description pour le produit suivant :

Nom : {{productName}}
{{#if category}}Catégorie : {{category}}{{/if}}
{{#if features}}
Caractéristiques :
{{#each features}}
- {{this}}
{{/each}}
{{/if}}

Ton : {{tone}}
Longueur : {{length}}`,
        variables: [
          { name: 'productName', type: 'string', required: true, description: 'Nom du produit' },
          { name: 'category', type: 'string', required: false, description: 'Catégorie du produit' },
          { name: 'features', type: 'array', required: false, description: 'Liste des caractéristiques' },
          { name: 'tone', type: 'string', required: false, defaultValue: 'professional', description: 'Ton de la description' },
          { name: 'length', type: 'string', required: false, defaultValue: 'medium', description: 'Longueur souhaitée' },
        ],
        defaultSettings: {
          temperature: 0.7,
          maxLength: 500,
          tone: 'professional',
        },
        tags: ['product', 'description', 'e-commerce'],
      },
      {
        name: 'SEO Meta Description',
        description: 'Template pour générer des méta-descriptions SEO optimisées',
        category: 'seo',
        systemPrompt: 'Tu es un expert SEO qui crée des méta-descriptions optimisées pour le référencement.',
        userPromptTemplate: `Génère une méta-description SEO pour :

Titre de la page : {{pageTitle}}
{{#if targetKeyword}}Mot-clé principal : {{targetKeyword}}{{/if}}
{{#if keywords}}Mots-clés secondaires : {{keywords}}{{/if}}

La méta-description doit :
- Faire entre 150 et 160 caractères
- Inclure le mot-clé principal naturellement
- Contenir un appel à l'action
- Être engageante et inciter au clic`,
        variables: [
          { name: 'pageTitle', type: 'string', required: true, description: 'Titre de la page' },
          { name: 'targetKeyword', type: 'string', required: false, description: 'Mot-clé principal' },
          { name: 'keywords', type: 'array', required: false, description: 'Mots-clés secondaires' },
        ],
        defaultSettings: {
          temperature: 0.7,
          maxLength: 200,
        },
        tags: ['seo', 'meta', 'description'],
      },
      {
        name: 'Post Réseaux Sociaux',
        description: 'Template pour créer des posts engageants pour les réseaux sociaux',
        category: 'social',
        systemPrompt: 'Tu es un expert des réseaux sociaux qui crée du contenu viral et engageant.',
        userPromptTemplate: `Crée un post pour {{platform}} :

Message principal : {{message}}
{{#if callToAction}}Call-to-action : {{callToAction}}{{/if}}
{{#if tone}}Ton : {{tone}}{{/if}}

- Utilise des emojis pertinents
- Inclus 3-5 hashtags stratégiques
- Crée un contenu qui génère de l'engagement`,
        variables: [
          { name: 'platform', type: 'string', required: true, description: 'Plateforme sociale (Facebook, LinkedIn, etc.)' },
          { name: 'message', type: 'string', required: true, description: 'Message principal' },
          { name: 'callToAction', type: 'string', required: false, description: 'Appel à l\'action' },
          { name: 'tone', type: 'string', required: false, defaultValue: 'friendly', description: 'Ton du post' },
        ],
        defaultSettings: {
          temperature: 0.8,
          maxLength: 300,
          tone: 'friendly',
        },
        tags: ['social', 'marketing', 'engagement'],
      },
    ];

    defaultTemplates.forEach((template) => {
      const id = this.generateId();
      this.templates.set(id, {
        ...template,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });
    });

    this.logger.log(`Initialized ${this.templates.size} default prompt templates`);
  }

  async listTemplates(): Promise<PromptTemplate[]> {
    return Array.from(this.templates.values());
  }

  async getTemplate(id: string): Promise<PromptTemplate> {
    const template = this.templates.get(id);
    
    if (!template) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }

    return template;
  }

  async createTemplate(dto: CreatePromptTemplateDto): Promise<PromptTemplate> {
    const id = this.generateId();
    
    const template = {
      ...dto,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    } as PromptTemplate;

    this.templates.set(id, template);
    this.logger.log(`Created new prompt template: ${template.name}`);

    return template;
  }

  async updateTemplate(id: string, dto: UpdatePromptTemplateDto): Promise<PromptTemplate> {
    const existing = await this.getTemplate(id);

    const updated = {
      ...existing,
      ...dto,
      updatedAt: new Date(),
    } as PromptTemplate;

    this.templates.set(id, updated);
    this.logger.log(`Updated prompt template: ${id}`);

    return updated;
  }

  async deleteTemplate(id: string): Promise<void> {
    const exists = this.templates.has(id);
    
    if (!exists) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }

    this.templates.delete(id);
    this.logger.log(`Deleted prompt template: ${id}`);
  }

  async testTemplate(id: string, variables: Record<string, any>): Promise<{ rendered: string }> {
    const template = await this.getTemplate(id);
    
    const rendered = this.renderTemplate(template.userPromptTemplate, variables);

    return { rendered };
  }

  async renderPrompt(id: string, variables: Record<string, any>): Promise<{
    system: string;
    user: string;
  }> {
    const template = await this.getTemplate(id);

    // Increment usage count
    template.usageCount = (template.usageCount || 0) + 1;
    this.templates.set(id, template);

    return {
      system: template.systemPrompt,
      user: this.renderTemplate(template.userPromptTemplate, variables),
    };
  }

  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;

    // Simple template rendering - replace {{variable}} with values
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, String(value || ''));
    });

    // Handle conditional blocks {{#if variable}}...{{/if}}
    rendered = rendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, variable, content) => {
      return variables[variable] ? content : '';
    });

    // Handle array iteration {{#each array}}...{{/each}}
    rendered = rendered.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (match, variable, content) => {
      const array = variables[variable];
      if (Array.isArray(array)) {
        return array.map(item => content.replace(/{{this}}/g, String(item))).join('');
      }
      return '';
    });

    // Clean up extra whitespace
    rendered = rendered.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    return rendered;
  }

  private generateId(): string {
    const hash = createHash('sha256');
    hash.update(`${Date.now()}-${Math.random()}`);
    return hash.digest('hex').substring(0, 16);
  }
}
