import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto, ReplyDto } from './dto/tickets.dto';
import { CurrentUser, AuthUser } from '../common/decorators';
@ApiTags('tickets') @ApiBearerAuth() @Controller('tickets')
export class TicketsController {
  constructor(private prisma: PrismaService) {}
  private async owned(id: string, u: AuthUser) {
    const t = await this.prisma.ticket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } }, user: { select: { id: true, email: true, name: true } } } });
    if (!t) throw new NotFoundException('Ticket not found');
    if (u.role === 'USER' && t.userId !== u.id) throw new ForbiddenException('Not your ticket');
    return t;
  }
  @Post() create(@Body() dto: CreateTicketDto, @CurrentUser() u: AuthUser) {
    return this.prisma.ticket.create({ data: { userId: u.id, subject: dto.subject, messages: { create: { authorId: u.id, body: dto.body } } }, include: { messages: true } });
  }
  @Get() async list(@CurrentUser() u: AuthUser) {
    return this.prisma.ticket.findMany({ where: u.role === 'USER' ? { userId: u.id } : {}, orderBy: { updatedAt: 'desc' }, include: { user: { select: { email: true, name: true } }, _count: { select: { messages: true } } } });
  }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.owned(id, u); }
  @Post(':id/reply') async reply(@Param('id') id: string, @Body() dto: ReplyDto, @CurrentUser() u: AuthUser) {
    await this.owned(id, u);
    await this.prisma.ticketMessage.create({ data: { ticketId: id, authorId: u.id, body: dto.body } });
    await this.prisma.ticket.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
    return this.owned(id, u);
  }
  @Patch(':id/status') async status(@Param('id') id: string, @Body() dto: { status: string }, @CurrentUser() u: AuthUser) {
    await this.owned(id, u);
    return this.prisma.ticket.update({ where: { id }, data: { status: dto.status as never } });
  }
}
