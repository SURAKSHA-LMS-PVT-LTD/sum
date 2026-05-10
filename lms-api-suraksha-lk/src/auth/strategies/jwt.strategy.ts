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
    const isEnhanced = this.isEnhancedPayload(payload);

    const userId = isEnhanced ? (payload as EnhancedJwtPayload).s : (payload as JwtPayload).sub;
    const rawUserType = isEnhanced ? (payload as EnhancedJwtPayload).u : (payload as JwtPayload).type;

    if (!payload || !userId) {
      throw new UnauthorizedException('Invalid token payload: Missing user identifier');
    }

    const userIdStr = userId.toString();
    let user: any;
    let resolvedUserType: string;

    if (isEnhanced) {
      resolvedUserType = COMPACT_TO_USER_TYPE[rawUserType as number];
    } else {
      resolvedUserType = rawUserType as string;
    }

    if (resolvedUserType === 'bookhire-owner') {
      user = await this.bookhireOwnerRepository.findOne({ where: { id: userIdStr } });
    } else {
      user = await this.userRepository.findOne({ 
        where: { id: userIdStr },
        select: ['id', 'email', 'firstName', 'lastName', 'isActive', 'userType', 'imageUrl']
      });
    }

    if (!user) {
      this.logger.error(`User not found for ID: ${userIdStr} and type: ${resolvedUserType}`);
      throw new UnauthorizedException('User not found');
    }
    
    const finalUserType = resolvedUserType === 'bookhire-owner' ? 'bookhire-owner' : user?.userType;

    if (!user.isActive) {
      this.logger.error(`Inactive user attempted login: ${userIdStr}`);
      throw new UnauthorizedException('User account is inactive');
    }

    const enhancedClaims = isEnhanced ? this.extractEnhancedClaims(payload as EnhancedJwtPayload) : null;

    const normalizedUser = {
      id: user.id,
      userId: user.id,
      sub: user.id,
      s: user.id,
      email: user.email,
      userType: finalUserType,
      firstName: user.firstName || user.name,
      lastName: user.lastName,
      imageUrl: user.imageUrl || user.profileImage,
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
