import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    console.log('🔍 JWT Strategy payload:', payload);
    
    // Поддерживаем как sub, так и userId для совместимости
    const userId = payload.sub || payload.userId;
    console.log('🔍 JWT Strategy userId:', userId);
    
    return { 
      sub: userId, 
      userId: userId, // Добавляем userId для совместимости
      email: payload.email,
      phone: payload.phone,
      role: payload.role 
    };
  }
}
