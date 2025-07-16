#!/usr/bin/env node

/**
 * MCP Entreprise - Agent de Migration Backend + Frontend
 *
 * Ce template automatise la migration de fichiers PHP legacy vers NestJS (backend) + Remix (frontend).
 * Il génère à la fois le contrôleur NestJS et la route Remix correspondante.
 */

const fs = require('fs');
const path = require('path');

class MigrationAgent {
    constructor(config = {}) {
        this.config = {
            sourceDir: config.sourceDir || '/workspaces/TEMPLATE_MCP_COMPLETE/TEMPLATE_MCP_ENTERPRISE/legacy-php-complet',
            targetBackendDir: config.targetBackendDir || '/workspaces/TEMPLATE_MCP_COMPLETE/nestjs-remix-monorepo/backend/src',
            targetFrontendDir: config.targetFrontendDir || '/workspaces/TEMPLATE_MCP_COMPLETE/nestjs-remix-monorepo/frontend/app',
            mappingFile: config.mappingFile || 'migration-mapping.json',
            ...config
        };
    }

    /**
     * Migration principale d'un fichier PHP
     */
    async autoMigrate(filename) {
        console.log('[MCP] Migration du fichier : ' + filename);
        try {
            // 1. Lecture du fichier source
            const filePath = path.join(this.config.sourceDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');

            // 2. Détection du type (exemple simplifié)
            const type = this.detectFileType(content);
            const baseName = filename.replace('.php', '');

            // 3. Génération Backend (NestJS Controller)
                const controllerCode =
`import { Controller, Get } from '@nestjs/common';

@Controller('${filename.replace('.php', '')}')
export class ${className} {
    @Get()
    findAll() {
        return ['OK'];
    }
}`;
                const outPath = path.join(this.config.targetBackendDir, `${className}.ts`);
                fs.mkdirSync(path.dirname(outPath), { recursive: true });
                fs.writeFileSync(outPath, controllerCode);
                console.log('[MCP] Controller genere : ' + outPath);
            }

            // 4. Mise à jour du mapping (simple)
            this.updateMapping(filename, type);
            console.log('[MCP] Migration terminee pour : ' + filename);
        } catch (err) {
            console.error('[MCP] Erreur migration :', err.message);
            throw err;
        }
    }

    /**
     * Détection très simple du type de fichier (exemple)
     */
    detectFileType(content) {
        if (content.includes('class') && content.includes('Controller')) return 'controller';
        return 'unknown';
    }

    /**
     * Mise à jour du mapping de migration (exemple minimal)
     */
    updateMapping(filename, type) {
        let mapping = [];
        try {
            mapping = JSON.parse(fs.readFileSync(this.config.mappingFile, 'utf8'));
        } catch (e) {}
        mapping.push({ filename, type, migrated: true, date: new Date().toISOString() });
        fs.writeFileSync(this.config.mappingFile, JSON.stringify(mapping, null, 2));
    }

    /**
     * Utilitaire : PascalCase
     */
    pascalCase(str) {
        return str.replace(/(?:^|-)(.)/g, (_, c) => c.toUpperCase()).replace(/-/g, '');
    }
}

module.exports = MigrationAgent;
