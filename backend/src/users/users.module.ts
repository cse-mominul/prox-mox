import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { JwtModule } from '@nestjs/jwt';
@Module({ imports: [JwtModule.register({})], controllers: [UsersController], providers: [UsersService, AuditService, AuthService], exports: [UsersService] })
export class UsersModule {}
