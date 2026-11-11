import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuditService } from '../audit/audit.service';
@Module({ imports: [JwtModule.register({})], controllers: [AuthController], providers: [AuthService, AuditService], exports: [AuthService] })
export class AuthModule {}
