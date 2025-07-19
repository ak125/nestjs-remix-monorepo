import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, BadRequestException, ForbiddenException, ParseIntPipe } from '@nestjs/common';
import { StaffAdminService, CreateStaffDto, UpdateStaffDto, AdminStaff } from './staff-admin-simple.service';
import { AuthGuard } from '@nestjs/passport';

interface RequestWithUser extends Request {
  user: {
    id: string;
    level: number;
    email: string;
  };
}

@Controller('staff')
@UseGuards(AuthGuard('local'))
export class StaffController {
  constructor(private readonly staffAdminService: StaffAdminService) {}

  /**
   * Récupère tous les administrateurs gérables
   */
  @Get()
  async findAllStaff(@Request() req: RequestWithUser): Promise<AdminStaff[]> {
    console.log('--- GET /staff ---');
    
    if (!req.user || !req.user.level) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur requis');
    }

    const currentUserLevel = req.user.level;
    console.log('Niveau utilisateur connecté:', currentUserLevel);

    if (currentUserLevel < 7) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur insuffisant');
    }

    return this.staffAdminService.findAllStaff(currentUserLevel);
  }

  /**
   * Récupère un administrateur par son ID
   */
    @Get(':id')
  async findStaffById(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser): Promise<AdminStaff> {
    console.log('--- GET /staff/:id ---');
    console.log('ID demandé:', id);
    
    if (!req.user || !req.user.level) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur requis');
    }

    const currentUserLevel = req.user.level;
    console.log('Niveau utilisateur connecté:', currentUserLevel);

    if (currentUserLevel < 7) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur insuffisant');
    }

    const staff = await this.staffAdminService.findStaffById(id, currentUserLevel);
    
    if (!staff) {
      throw new BadRequestException(`Administrateur avec l'ID ${id} non trouvé ou inaccessible`);
    }

    return staff;
  }

  /**
   * Crée un nouvel administrateur
   */
  @Post()
  async createStaff(@Body() staffData: CreateStaffDto, @Request() req: RequestWithUser): Promise<AdminStaff> {
    console.log('--- POST /staff ---');
    console.log('Données staff:', staffData);
    
    if (!req.user || !req.user.level) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur requis');
    }

    const currentUserLevel = req.user.level;
    console.log('Niveau utilisateur connecté:', currentUserLevel);

    if (currentUserLevel < 8) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur de niveau 8+ requis pour créer du staff');
    }

    // Vérifier que le niveau demandé est inférieur à celui de l'utilisateur
    if (staffData.level >= currentUserLevel) {
      throw new ForbiddenException('Impossible de créer un staff de niveau égal ou supérieur au vôtre');
    }

    const newStaff = await this.staffAdminService.createStaff(staffData);
    return newStaff;
  }

  /**
   * Met à jour un administrateur
   */
  @Patch(':id')
  async updateStaff(
    @Param('id', ParseIntPipe) id: number,
    @Body() staffData: UpdateStaffDto,
    @Request() req: RequestWithUser
  ): Promise<AdminStaff> {
    console.log('--- PATCH /staff/:id ---');
    console.log('ID:', id, 'Données:', staffData);
    
    if (!req.user || !req.user.level) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur requis');
    }

    const currentUserLevel = req.user.level;
    if (currentUserLevel < 8) {
      throw new ForbiddenException('Accès refusé - Niveau 8 minimum requis pour modifier un administrateur');
    }

    // Vérifier que l'administrateur existe
    const existingStaff = await this.staffAdminService.findStaffById(id, currentUserLevel);
    if (!existingStaff) {
      throw new BadRequestException('Administrateur non trouvé');
    }

    // Vérifier si l'utilisateur peut gérer cet administrateur
    if (!this.staffAdminService.canManageStaff(currentUserLevel, existingStaff.cnfa_level)) {
      throw new ForbiddenException('Accès refusé - Niveau insuffisant pour gérer cet administrateur');
    }

    // Si le niveau est modifié, vérifier les permissions
    if (staffData.level !== undefined) {
      if (!this.staffAdminService.canManageStaff(currentUserLevel, staffData.level)) {
        throw new ForbiddenException('Accès refusé - Impossible de définir un niveau supérieur ou égal');
      }
    }

    const updatedStaff = await this.staffAdminService.updateStaff(id, staffData, currentUserLevel);
    if (!updatedStaff) {
      throw new BadRequestException('Erreur lors de la mise à jour de l\'administrateur');
    }

    return updatedStaff;
  }

  /**
   * Active un administrateur
   */
  @Patch(':id/enable')
  async enableStaff(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser): Promise<{ success: boolean }> {
    console.log('--- PATCH /staff/:id/enable ---');
    console.log('ID administrateur:', id);
    
    if (!req.user || !req.user.level) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur requis');
    }

    const currentUserLevel = req.user.level;
    if (currentUserLevel < 8) {
      throw new ForbiddenException('Accès refusé - Niveau 8 minimum requis');
    }

    // Vérifier que l'administrateur existe
    const existingStaff = await this.staffAdminService.findStaffById(id, currentUserLevel);
    if (!existingStaff) {
      throw new BadRequestException('Administrateur non trouvé');
    }

    // Vérifier si l'utilisateur peut gérer cet administrateur
    if (!this.staffAdminService.canManageStaff(currentUserLevel, existingStaff.cnfa_level)) {
      throw new ForbiddenException('Accès refusé - Niveau insuffisant pour gérer cet administrateur');
    }

    const success = await this.staffAdminService.enableStaff(id, currentUserLevel);
    if (!success) {
      throw new BadRequestException('Erreur lors de l\'activation de l\'administrateur');
    }

    return { success: true };
  }

  /**
   * Désactive un administrateur
   */
  @Patch(':id/disable')
  async disableStaff(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser): Promise<{ success: boolean }> {
    console.log('--- PATCH /staff/:id/disable ---');
    console.log('ID administrateur:', id);
    
    if (!req.user || !req.user.level) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur requis');
    }

    const currentUserLevel = req.user.level;
    if (currentUserLevel < 8) {
      throw new ForbiddenException('Accès refusé - Niveau 8 minimum requis');
    }

    // Vérifier que l'administrateur existe
    const existingStaff = await this.staffAdminService.findStaffById(id, currentUserLevel);
    if (!existingStaff) {
      throw new BadRequestException('Administrateur non trouvé');
    }

    // Vérifier si l'utilisateur peut gérer cet administrateur
    if (!this.staffAdminService.canManageStaff(currentUserLevel, existingStaff.cnfa_level)) {
      throw new ForbiddenException('Accès refusé - Niveau insuffisant pour gérer cet administrateur');
    }

    const success = await this.staffAdminService.disableStaff(id, currentUserLevel);
    if (!success) {
      throw new BadRequestException('Erreur lors de la désactivation de l\'administrateur');
    }

    return { success: true };
  }

  /**
   * Statistiques du staff
   */
  @Get('stats/overview')
  async getStaffStats(@Request() req: RequestWithUser): Promise<{
    total: number;
    active: number;
    inactive: number;
    byLevel: Record<number, number>;
  }> {
    console.log('--- GET /staff/stats/overview ---');
    
    if (!req.user || !req.user.level) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur requis');
    }

    const currentUserLevel = req.user.level;
    if (currentUserLevel < 8) {
      throw new ForbiddenException('Accès refusé - Niveau 8 minimum requis pour voir les statistiques');
    }

    return this.staffAdminService.getStaffStats(currentUserLevel);
  }

  /**
   * Récupère les permissions d'un niveau
   */
  @Get('permissions/:level')
  async getPermissions(@Param('level', ParseIntPipe) level: number, @Request() req: RequestWithUser): Promise<{ permissions: string[] }> {
    console.log('--- GET /staff/permissions/:level ---');
    console.log('Niveau demandé:', level);
    
    if (!req.user || !req.user.level) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur requis');
    }

    const currentUserLevel = req.user.level;
    if (currentUserLevel < 7) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur insuffisant');
    }

    const permissions = this.staffAdminService.getStaffPermissions(level);
    return { permissions };
  }

  /**
   * Crée un super-administrateur niveau 9
   */
  @Post('super-admin')
  async createSuperAdmin(@Body() adminData: {
    login: string;
    password: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  }, @Request() req: RequestWithUser): Promise<AdminStaff> {
    console.log('--- POST /staff/super-admin ---');
    console.log('Création Super-Admin niveau 9');
    
    if (!req.user || !req.user.level) {
      throw new ForbiddenException('Accès refusé - Niveau administrateur requis');
    }

    const currentUserLevel = req.user.level;
    if (currentUserLevel < 9) {
      throw new ForbiddenException('Accès refusé - Seul un super-administrateur niveau 9 peut créer un autre super-administrateur');
    }

    const superAdmin = await this.staffAdminService.createSuperAdmin(adminData);
    if (!superAdmin) {
      throw new BadRequestException('Erreur lors de la création du super-administrateur');
    }

    return superAdmin;
  }
}
