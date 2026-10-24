import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Post, UnauthorizedException, UseGuards, createParamDecorator } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { PrismaService } from './prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

export class LoginDto {
  @ApiProperty({example:'hai@demo.test'}) @IsEmail() email!: string;
  @ApiProperty({example:'Demo123!'}) @IsString() @MinLength(4) password!: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest().user);

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService) {}
  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({where:{email:email.trim().toLowerCase()}});
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const access_token = jwt.sign({sub: String(user.id),ver:user.authVersion}, process.env.JWT_SECRET as string, {expiresIn:'8h'});
    return {access_token, token_type:'bearer', user: publicUser(user)};
  }
}

export function publicUser(user: User) {
  const holdings = Array.isArray(user.holdings) ? user.holdings as any[] : [];
  return {id:user.id, name:user.displayName, email:user.email, role:user.role,
    ekyc_verified:user.ekycVerified, owned_companies:holdings.map(h => String(h.company || ''))};
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    if (!match) throw new UnauthorizedException('Thiếu Bearer token');
    try {
      const decoded = jwt.verify(match[1], process.env.JWT_SECRET as string) as jwt.JwtPayload;
      if (!Number.isInteger(Number(decoded.sub))) throw new Error('Invalid sub');
      const user = await this.db.user.findUnique({where:{id:Number(decoded.sub)}});
      if (!user || decoded.ver !== user.authVersion) throw new Error('Missing user or revoked token');
      req.user = user;
      return true;
    } catch { throw new UnauthorizedException('Token hết hạn hoặc không hợp lệ'); }
  }
}

@ApiTags('Auth')
@Controller('api/v1')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('auth/login') login(@Body() data: LoginDto) { return this.auth.login(data.email, data.password); }
  @ApiBearerAuth() @UseGuards(AuthGuard) @Get('me') me(@CurrentUser() user: User) {return publicUser(user);}
}
