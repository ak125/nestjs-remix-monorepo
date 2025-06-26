// ...existing imports...
// MCP SDK Integration - Context-7 Support
import { 
  MCPContext, 
  ContextManager, 
  validateUser as mcpValidateUser,
  formatDateTime,
  generateSecureId,
  logAuditEvent 
} from '@mcp/sdk';

export interface JwtPayload {
  sub: number;
  email: string;
  role?: string;
  // MCP Context-7 fields
  contextId?: string;
  sessionId?: string;
  mcpVersion: string;
}

// ...existing interfaces...

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // MCP Context Manager Integration
  private readonly contextManager = new ContextManager();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validate user credentials with MCP Context-7 integration
   */
  async validateUser(email: string, password: string): Promise<any> {
    this.logger.debug(`Validating user with MCP Context: ${email}`);
    
    try {
      // Create MCP Context for validation
      const mcpContext = await this.contextManager.createContext({
        userId: email,
        action: 'user_validation',
        timestamp: new Date(),
        source: 'auth-service',
        version: '7.0',
        metadata: {
          userAgent: 'MCP-Backend',
          ipAddress: 'localhost', // Would come from request in real scenario
        }
      });

      // Log audit event using MCP SDK
      await logAuditEvent({
        action: 'LOGIN_ATTEMPT',
        userId: email,
        contextId: mcpContext.id,
        timestamp: formatDateTime(new Date()),
        details: { method: 'email_password' }
      });

      const user = await this.prisma.customer.findUnique({
        where: { email },
      });

      if (!user) {
        this.logger.warn(`User not found: ${email}`);
        await this.contextManager.updateContext(mcpContext.id, {
          status: 'failed',
          reason: 'user_not_found'
        });
        return null;
      }

      // Use MCP SDK for additional user validation
      const mcpValidationResult = await mcpValidateUser({
        email: user.email,
        isActive: user.isActive,
        lastLogin: user.updatedAt,
        contextId: mcpContext.id
      });

      if (!mcpValidationResult.isValid) {
        this.logger.warn(`MCP validation failed for user: ${email} - ${mcpValidationResult.reason}`);
        await this.contextManager.updateContext(mcpContext.id, {
          status: 'failed',
          reason: mcpValidationResult.reason
        });
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password for user: ${email}`);
        await this.contextManager.updateContext(mcpContext.id, {
          status: 'failed',
          reason: 'invalid_password'
        });
        return null;
      }

      if (!user.isActive) {
        this.logger.warn(`Inactive account: ${email}`);
        throw new UnauthorizedException('Account is not activated');
      }

      // Update MCP Context on successful validation
      await this.contextManager.updateContext(mcpContext.id, {
        status: 'success',
        userId: user.id,
        permissions: user.role ? [user.role] : ['USER']
      });

      // Log successful validation
      await logAuditEvent({
        action: 'LOGIN_SUCCESS',
        userId: user.id.toString(),
        contextId: mcpContext.id,
        timestamp: formatDateTime(new Date()),
        details: { 
          method: 'email_password',
          mcpVersion: '7.0'
        }
      });

      const { password: _, ...result } = user;
      // Attach MCP context to user result
      return { 
        ...result, 
        mcpContext: {
          id: mcpContext.id,
          sessionId: generateSecureId(),
          version: '7.0'
        }
      };
    } catch (error) {
      this.logger.error(`Error validating user ${email}:`, error.message);
      throw error;
    }
  }

  /**
   * Login user and generate JWT token with MCP Context-7
   */
  async login(user: any): Promise<LoginResponse> {
    this.logger.debug(`Generating MCP-enhanced token for user ID: ${user.id}`);
    
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      // MCP Context-7 integration
      contextId: user.mcpContext?.id,
      sessionId: user.mcpContext?.sessionId,
      mcpVersion: '7.0',
    };

    const access_token = this.jwtService.sign(payload);

    // Log token generation with MCP Context
    await logAuditEvent({
      action: 'TOKEN_GENERATED',
      userId: user.id.toString(),
      contextId: user.mcpContext?.id,
      timestamp: formatDateTime(new Date()),
      details: {
        tokenType: 'JWT',
        expiresIn: '24h',
        mcpVersion: '7.0'
      }
    });

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        civility: user.civility,
        isActive: user.isActive,
        role: user.role,
      },
      // MCP Context information
      mcpContext: user.mcpContext,
    };
  }

  }

  /**
   * Register new user with MCP Context integration
   */
  async register(registerDto: RegisterDto): Promise<{ message: string; user: any }> {
    this.logger.debug(`Registering new user with MCP: ${registerDto.email}`);
    
    try {
      // Create MCP Context for registration
      const mcpContext = await this.contextManager.createContext({
        userId: registerDto.email,
        action: 'user_registration',
        timestamp: new Date(),
        source: 'auth-service',
        version: '7.0'
      });

      // Check if user already exists
      const existingUser = await this.prisma.customer.findUnique({
        where: { email: registerDto.email },
      });

      if (existingUser) {
        await this.contextManager.updateContext(mcpContext.id, {
          status: 'failed',
          reason: 'user_already_exists'
        });
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

      // Generate verification token using MCP SDK
      const verificationToken = generateSecureId();

      // Create user
      const user = await this.prisma.customer.create({
        data: {
          email: registerDto.email,
          password: hashedPassword,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          civility: registerDto.civility,
          phone: registerDto.phone,
          isActive: false, // Require email verification
          verificationToken,
          createdAt: new Date(),
        },
      });

      // Update MCP Context on successful registration
      await this.contextManager.updateContext(mcpContext.id, {
        status: 'success',
        userId: user.id,
        requiresVerification: true
      });

      // Log registration event
      await logAuditEvent({
        action: 'USER_REGISTERED',
        userId: user.id.toString(),
        contextId: mcpContext.id,
        timestamp: formatDateTime(new Date()),
        details: {
          email: user.email,
          requiresVerification: true,
          mcpVersion: '7.0'
        }
      });

      const { password: _, verificationToken: __, ...userResponse } = user;
      
      return {
        message: 'User registered successfully. Please check your email to verify your account.',
        user: userResponse,
      };
    } catch (error) {
      this.logger.error(`Error registering user ${registerDto.email}:`, error.message);
      throw error;
    }
  }

  // Remaining methods would be similarly enhanced with MCP Context-7 integration...