import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClustersService } from './clusters.service';
import { CreateClusterDto, UpdateClusterDto } from './dto/clusters.dto';
import { Roles, CurrentUser, AuthUser, ClientIp } from '../common/decorators';
@ApiTags('clusters') @ApiBearerAuth() @Controller('clusters')
export class ClustersController {
  constructor(private clusters: ClustersService) {}
  @Roles('SUPER_ADMIN', 'ADMIN') @Post() create(@Body() dto: CreateClusterDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.clusters.create(dto, u.id, ip); }
  @Get() list() { return this.clusters.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.clusters.get(id); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateClusterDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.clusters.update(id, dto, u.id, ip); }
  @Roles('SUPER_ADMIN') @Delete(':id') remove(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.clusters.remove(id, u.id, ip); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Post(':id/test') test(@Param('id') id: string) { return this.clusters.testConnection(id); }
  @Get(':id/nodes') nodes(@Param('id') id: string) { return this.clusters.nodes(id); }
  @Get(':id/storages') storages(@Param('id') id: string, @Query('node') node: string) { return this.clusters.storages(id, node); }
  @Get(':id/isos') isos(@Param('id') id: string, @Query('node') node: string, @Query('storage') storage = 'local') { return this.clusters.isos(id, node, storage); }
  @Get(':id/templates') templates(@Param('id') id: string, @Query('node') node: string) { return this.clusters.templates(id, node); }
  @Get(':id/bridges') bridges(@Param('id') id: string, @Query('node') node: string) { return this.clusters.bridges(id, node); }
}
