import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { PlanDto } from './dto/plans.dto';
import { Roles } from '../common/decorators';
@ApiTags('plans') @ApiBearerAuth() @Controller('plans')
export class PlansController {
  constructor(private prisma: PrismaService) {}
  @Get() list() { return this.prisma.plan.findMany({ where: { enabled: true }, orderBy: { priceMonthly: 'asc' } }); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Get('all') all() { return this.prisma.plan.findMany({ orderBy: { createdAt: 'asc' } }); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Post() create(@Body() dto: PlanDto) { return this.prisma.plan.create({ data: dto }); }
  @Roles('SUPER_ADMIN', 'ADMIN') @Put(':id') update(@Param('id') id: string, @Body() dto: PlanDto) { return this.prisma.plan.update({ where: { id }, data: dto }); }
  @Roles('SUPER_ADMIN') @Delete(':id') remove(@Param('id') id: string) { return this.prisma.plan.delete({ where: { id } }); }
}
