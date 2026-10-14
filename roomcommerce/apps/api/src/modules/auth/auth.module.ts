import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { EntitlementGuard } from './guards/entitlement.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, EntitlementGuard],
  exports: [AuthService, JwtAuthGuard, EntitlementGuard],
})
export class AuthModule {}
