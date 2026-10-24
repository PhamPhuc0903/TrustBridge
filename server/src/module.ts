import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthService, AuthController, AuthGuard } from './auth';
import { AiAdapter } from './ai';
import { TrustbridgeService } from './trustbridge.service';
import { TrustbridgeController, DemoController, HealthController } from './trustbridge.controller';
@Module({
  providers: [PrismaService, AuthService, AuthGuard, AiAdapter, TrustbridgeService],
  controllers: [HealthController, AuthController, TrustbridgeController, DemoController]
})
export class AppModule {}
