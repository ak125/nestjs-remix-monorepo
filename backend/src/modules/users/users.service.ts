import { Injectable, Logger, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, UserSearchDto, UserRole, UserStatus } from './dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<any> {
    this.logger.log('Création d\'un nouvel utilisateur', { email: createUserDto.email });

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.customer.findUnique({
      where: { email: createUserDto.email }
    });

    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // Hasher le mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    const user = await this.prisma.customer.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        phone: createUserDto.phone || '',
        company: createUserDto.company || '',
        address: createUserDto.address || '',
        city: createUserDto.city || '',
        zipCode: createUserDto.zipCode || '',
        country: createUserDto.country || 'FR',
        civility: 'M', // Valeur par défaut
        role: createUserDto.role || UserRole.CUSTOMER,
        status: createUserDto.status || UserStatus.PENDING,
        isActive: createUserDto.status === UserStatus.ACTIVE
      }
    });

    this.logger.log(`Utilisateur créé avec succès`, { userId: user.id, email: user.email });

    // Exclure le mot de passe du résultat
    const { password: _, ...userResponse } = user;
    return userResponse;
  }

  async findAll(searchDto?: UserSearchDto): Promise<any[]> {
    this.logger.log('Récupération de la liste des utilisateurs');

    const where: any = {};

    if (searchDto?.email) {
      where.email = { contains: searchDto.email, mode: 'insensitive' };
    }

    if (searchDto?.name) {
      where.OR = [
        { firstName: { contains: searchDto.name, mode: 'insensitive' } },
        { lastName: { contains: searchDto.name, mode: 'insensitive' } }
      ];
    }

    if (searchDto?.role) {
      where.role = searchDto.role;
    }

    if (searchDto?.status) {
      where.status = searchDto.status;
    }

    if (searchDto?.company) {
      where.company = { contains: searchDto.company, mode: 'insensitive' };
    }

    const users = await this.prisma.customer.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        company: true,
        address: true,
        city: true,
        zipCode: true,
        country: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    this.logger.log(`${users.length} utilisateurs récupérés`);
    return users;
  }

  async findOne(id: number): Promise<any> {
    const user = await this.prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        company: true,
        address: true,
        city: true,
        zipCode: true,
        country: true,
        civility: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<any> {
    const user = await this.prisma.customer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        company: true,
        address: true,
        city: true,
        zipCode: true,
        country: true,
        civility: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'email ${email} non trouvé`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<any> {
    // Vérifier que l'utilisateur existe
    await this.findOne(id);

    const user = await this.prisma.customer.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        company: true,
        address: true,
        city: true,
        zipCode: true,
        country: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    this.logger.log(`Utilisateur ${id} mis à jour`);
    return user;
  }

  async remove(id: number): Promise<{ message: string }> {
    // Vérifier que l'utilisateur existe
    await this.findOne(id);

    await this.prisma.customer.delete({
      where: { id }
    });

    this.logger.log(`Utilisateur ${id} supprimé`);
    return { message: `Utilisateur ${id} supprimé avec succès` };
  }

  async changePassword(id: number, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    // Récupérer l'utilisateur avec le mot de passe
    const user = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, password: true }
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
    }

    // Vérifier l'ancien mot de passe
    const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    // Hasher le nouveau mot de passe
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);

    // Mettre à jour le mot de passe
    await this.prisma.customer.update({
      where: { id },
      data: { password: hashedNewPassword }
    });

    this.logger.log(`Mot de passe changé pour l'utilisateur ${id}`);
    return { message: 'Mot de passe changé avec succès' };
  }

  async activateUser(id: number): Promise<any> {
    const user = await this.update(id, { 
      status: UserStatus.ACTIVE, 
      isActive: true 
    });

    this.logger.log(`Utilisateur ${id} activé`);
    return user;
  }

  async suspendUser(id: number): Promise<any> {
    const user = await this.update(id, { 
      status: UserStatus.SUSPENDED, 
      isActive: false 
    });

    this.logger.log(`Utilisateur ${id} suspendu`);
    return user;
  }

  async getUserStats(): Promise<any> {
    this.logger.log('Récupération des statistiques utilisateurs');

    const [total, active, suspended, pending, customers, resellers, admins] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.customer.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.customer.count({ where: { status: UserStatus.PENDING } }),
      this.prisma.customer.count({ where: { role: UserRole.CUSTOMER } }),
      this.prisma.customer.count({ where: { role: UserRole.RESELLER } }),
      this.prisma.customer.count({ where: { role: UserRole.ADMIN } })
    ]);

    const stats = {
      total,
      byStatus: { active, suspended, pending },
      byRole: { customers, resellers, admins }
    };

    this.logger.log('Statistiques utilisateurs récupérées', { stats });
    return stats;
  }
}
