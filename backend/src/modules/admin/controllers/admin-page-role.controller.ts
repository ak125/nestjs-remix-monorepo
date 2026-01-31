/**
 * 🎯 ADMIN PAGE ROLE CONTROLLER
 *
 * API pour la validation et visualisation des PageRoles SEO
 * Endpoints:
 * - GET  /api/admin/page-role/detect?url=...     → Détecter le rôle d'une URL
 * - POST /api/admin/page-role/validate           → Valider le contenu d'une page
 * - GET  /api/admin/page-role/check-link?...     → Vérifier si un lien est autorisé
 * - GET  /api/admin/page-role/matrix             → Matrice complète des liens autorisés
 * - GET  /api/admin/page-role/rules              → Règles par rôle
 * - GET  /api/admin/page-role/hierarchy          → Hiérarchie des rôles
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { PageRoleValidatorService } from '../../seo/services/page-role-validator.service';
import {
  PageRole,
  PAGE_ROLE_META,
  PAGE_ROLE_HIERARCHY,
  ALLOWED_LINKS,
  getPageRoleFromUrl,
} from '../../seo/types/page-role.types';

interface DetectRoleResponse {
  url: string;
  role: PageRole | null;
  roleLabel: string | null;
  meta: {
    label: string;
    intention: string;
    maxWords?: number;
    indexable: boolean;
  } | null;
}

interface ValidateContentRequest {
  url: string;
  content: string;
}

interface CheckLinkResponse {
  source: string;
  target: string;
  sourceRole: PageRole | null;
  targetRole: PageRole | null;
  isAllowed: boolean;
  violation: {
    type: string;
    message: string;
    severity: 'warning' | 'error';
  } | null;
}

interface ValidateContentResponse {
  url: string;
  detectedRole: PageRole | null;
  declaredRole?: PageRole;
  isValid: boolean;
  violations: Array<{
    type: string;
    message: string;
    severity: 'warning' | 'error';
  }>;
  summary: {
    totalViolations: number;
    errors: number;
    warnings: number;
  };
}

interface LinkMatrixResponse {
  matrix: Record<string, { allowedTargets: string[]; description: string }>;
  table: Record<string, Record<string, boolean>>;
  roles: Array<{ id: string; label: string; intention: string }>;
}

interface RulesResponse {
  rules: Record<
    string,
    {
      label: string;
      intention: string;
      maxWords?: number;
      indexable: boolean;
      allowedLinks: string[];
      description: string;
    }
  >;
}

interface HierarchyResponse {
  hierarchy: Array<{
    role: PageRole;
    label: string;
    position: number;
    description: string;
  }>;
  description: string;
}

@Controller('api/admin/page-role')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminPageRoleController {
  private readonly logger = new Logger(AdminPageRoleController.name);

  constructor(private readonly validator: PageRoleValidatorService) {}

  /**
   * GET /api/admin/page-role/detect?url=/pieces/freinage-1.html
   * Détecte le rôle SEO d'une URL
   */
  @Get('detect')
  detectRole(@Query('url') url: string): DetectRoleResponse {
    if (!url) {
      throw new BadRequestException('URL requise');
    }

    const role = getPageRoleFromUrl(url);
    const meta = role ? PAGE_ROLE_META[role] : null;

    return {
      url,
      role,
      roleLabel: role || null,
      meta,
    };
  }

  /**
   * POST /api/admin/page-role/validate
   * Valide le contenu d'une page selon son rôle
   */
  @Post('validate')
  validateContent(
    @Body() body: ValidateContentRequest,
  ): ValidateContentResponse {
    if (!body.url) {
      throw new BadRequestException('URL requise');
    }
    if (!body.content) {
      throw new BadRequestException('Contenu requis');
    }

    this.logger.log(`Validating content for URL: ${body.url}`);

    const result = this.validator.validatePage(body.url, body.content);

    return {
      ...result,
      summary: {
        totalViolations: result.violations.length,
        errors: result.violations.filter((v) => v.severity === 'error').length,
        warnings: result.violations.filter((v) => v.severity === 'warning')
          .length,
      },
    };
  }

  /**
   * GET /api/admin/page-role/check-link?source=/url1&target=/url2
   * Vérifie si un lien source→target est autorisé
   */
  @Get('check-link')
  checkLink(
    @Query('source') source: string,
    @Query('target') target: string,
  ): CheckLinkResponse {
    if (!source || !target) {
      throw new BadRequestException('Source et target requis');
    }

    const sourceRole = getPageRoleFromUrl(source);
    const targetRole = getPageRoleFromUrl(target);
    const violation = this.validator.validateLink(source, target);

    return {
      source,
      target,
      sourceRole,
      targetRole,
      isAllowed: violation === null,
      violation,
    };
  }

  /**
   * GET /api/admin/page-role/matrix
   * Retourne la matrice complète des liens autorisés
   */
  @Get('matrix')
  getLinkMatrix(): LinkMatrixResponse {
    // Transformer ALLOWED_LINKS en format plus exploitable pour le frontend
    const matrix: Record<
      string,
      { allowedTargets: string[]; description: string }
    > = {};

    for (const [sourceRole, targets] of Object.entries(ALLOWED_LINKS)) {
      const sourceMeta = PAGE_ROLE_META[sourceRole as PageRole];
      matrix[sourceRole] = {
        allowedTargets: targets as string[],
        description: sourceMeta?.intention || '',
      };
    }

    // Créer aussi une représentation tabulaire
    const roles = Object.values(PageRole);
    const table: Record<string, Record<string, boolean>> = {};

    for (const from of roles) {
      table[from] = {};
      for (const to of roles) {
        const allowed = ALLOWED_LINKS[from]?.includes(to) || false;
        table[from][to] = allowed;
      }
    }

    return {
      matrix,
      table,
      roles: roles.map((r) => ({
        id: r,
        label: PAGE_ROLE_META[r]?.label || r,
        intention: PAGE_ROLE_META[r]?.intention || '',
      })),
    };
  }

  /**
   * GET /api/admin/page-role/rules
   * Retourne les règles détaillées par rôle
   */
  @Get('rules')
  getRules(): RulesResponse {
    const rules: Record<
      string,
      {
        label: string;
        intention: string;
        maxWords?: number;
        indexable: boolean;
        allowedLinks: string[];
        description: string;
      }
    > = {};

    for (const role of Object.values(PageRole)) {
      const meta = PAGE_ROLE_META[role];
      rules[role] = {
        label: meta.label,
        intention: meta.intention,
        maxWords: meta.maxWords,
        indexable: meta.indexable,
        allowedLinks: ALLOWED_LINKS[role] || [],
        description: this.getRoleDescription(role),
      };
    }

    return { rules };
  }

  /**
   * GET /api/admin/page-role/hierarchy
   * Retourne la hiérarchie des rôles
   */
  @Get('hierarchy')
  getHierarchy(): HierarchyResponse {
    return {
      hierarchy: PAGE_ROLE_HIERARCHY.map((role, index) => ({
        role,
        label: PAGE_ROLE_META[role]?.label || role,
        position: index + 1,
        description: PAGE_ROLE_META[role]?.intention || '',
      })),
      description:
        'Hiérarchie: R4 (Référence) → R3 (Blog) → R5 (Diagnostic) → R1 (Routeur) → R2 (Produit) → R6 (Support)',
    };
  }

  /**
   * Description détaillée pour chaque rôle
   */
  private getRoleDescription(role: PageRole): string {
    const descriptions: Record<PageRole, string> = {
      [PageRole.R1_ROUTER]:
        'Pages de navigation/sélection. ≤150 mots, pas de symptômes. Aide à trouver le bon produit.',
      [PageRole.R2_PRODUCT]:
        "Pages produit transactionnelles. Prix/CTA requis. Pas de bloc 'choisir véhicule'.",
      [PageRole.R3_BLOG]:
        'Contenu pédagogique/expert. Pas de filtres commerciaux. Ton éducatif.',
      [PageRole.R4_REFERENCE]:
        'Définitions techniques intemporelles. Pas de prix, pas de marques véhicule.',
      [PageRole.R5_DIAGNOSTIC]:
        'Identification de symptômes. Vocabulaire diagnostic requis, pas commercial.',
      [PageRole.R6_SUPPORT]:
        'Pages support/légales. Pas de liens sortants SEO.',
    };
    return descriptions[role] || '';
  }
}
