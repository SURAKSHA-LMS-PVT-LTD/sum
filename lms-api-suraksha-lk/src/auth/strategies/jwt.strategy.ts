import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../modules/user/entities/user.entity';
import { BookhireOwnerEntity } from '../../modules/private-transportation/entities/bookhire-owner.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { 
  EnhancedInstituteAccessEntry, 
  EnhancedJwtPayload, 
  GLOBAL_INSTITUTE_ACCESS_FLAG,
  COMPACT_TO_USER_TYPE
} from '../interfaces/enhanced-jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(BookhireOwnerEntity)
    private bookhireOwnerRepository: Repository<BookhireOwnerEntity>
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET is not configured!');
    }
    if (jwtSecret.length < 64) {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET is too short!');
    }
    const weakSecrets = ['secret', 'fallback-secret-key', 'your-secret-key', 'jwt-secret', 'change-me', '123456789', 'password', 'qwerty'];
    if (weakSecrets.includes(jwtSecret.toLowerCase())) {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET is using a default/weak value!');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload | EnhancedJwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const userId = payload.sub.toString();
    let user: any;
    let userType: string;

    if (payload.type === 'bookhire-owner') {
      user = await this.bookhireOwnerRepository.findOne({ where: { id: userId } });
      userType = 'bookhire-owner';
    } else {
      user = await this.userRepository.findOne({ 
        where: { id: userId },
        select: ['id', 'email', 'firstName', 'lastName', 'isActive', 'userType', 'imageUrl']
      });
      userType = user?.userType;
    }

    if (!user) {
      this.logger.error(`User not found for ID: ${userId} and type: ${payload.type}`);
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      this.logger.error(`Inactive user attempted login: ${userId}`);
      throw new UnauthorizedException('User account is inactive');
    }

    const isEnhanced = this.isEnhancedPayload(payload);
    const enhancedClaims = isEnhanced ? this.extractEnhancedClaims(payload as EnhancedJwtPayload) : null;

    // Normalize the user object to a consistent shape
    const normalizedUser = {
      id: user.id,
      userId: user.id,
      sub: user.id,
      s: user.id,
      email: user.email,
      userType: userType,
      firstName: user.firstName || user.name, // Use name from BookhireOwner
      lastName: user.lastName,
      imageUrl: user.imageUrl || user.profileImage, // Use profileImage from BookhireOwner
      jwtPayload: payload,
      ...payload,
      hasGlobalInstituteAccess: enhancedClaims?.hasGlobalAccess ?? false,
      enhancedInstituteAccess: enhancedClaims?.instituteAccess,
      enhancedChildrenAccess: enhancedClaims?.childrenAccess
    };

    return normalizedUser;
  }

  private isEnhancedPayload(payload: any): payload is EnhancedJwtPayload {
    return payload && typeof payload.u === 'number';
  }

  private extractEnhancedClaims(
    payload: EnhancedJwtPayload
  ): {
    hasGlobalAccess: boolean;
    instituteAccess?: EnhancedInstituteAccessEntry[];
    childrenAccess?: string[];
  } | null {
    if (!payload || (payload.i === undefined && payload.c === undefined)) {
      return null;
    }

    const rawInstituteAccess = payload.i;
    let hasGlobalAccess = false;
    let instituteAccess: EnhancedInstituteAccessEntry[] | undefined;

    if (Array.isArray(rawInstituteAccess)) {
      instituteAccess = rawInstituteAccess;
    } else if (typeof rawInstituteAccess === 'number') {
      hasGlobalAccess = rawInstituteAccess === GLOBAL_INSTITUTE_ACCESS_FLAG;
    }

    const childrenAccess = payload.c ? [...payload.c] : undefined;

    return {
      hasGlobalAccess,
      instituteAccess,
      childrenAccess
    };
  }
}
