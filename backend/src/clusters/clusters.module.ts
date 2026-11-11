import { Module } from '@nestjs/common';
import { ClustersService } from './clusters.service';
import { ClustersController } from './clusters.controller';
import { AuditService } from '../audit/audit.service';
@Module({ controllers: [ClustersController], providers: [ClustersService, AuditService], exports: [ClustersService] })
export class ClustersModule {}
