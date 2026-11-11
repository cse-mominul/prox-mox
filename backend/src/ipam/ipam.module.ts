import { Module } from '@nestjs/common';
import { IpamController } from './ipam.controller';
@Module({ controllers: [IpamController] })
export class IpamModule {}
