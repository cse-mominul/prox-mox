import { Injectable } from '@nestjs/common';
import { NotificationType } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService, private mail: MailService) {}
  async create(userId: string, type: NotificationType, title: string, body?: string, email = false) {
    const n = await this.prisma.notification.create({ data: { userId, type, title, body } });
    if (email) { const u = await this.prisma.user.findUnique({ where: { id: userId } }); if (u) await this.mail.notify(u.email, title, body).catch(() => undefined); }
    return n;
  }
  list(userId: string) { return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }); }
  async markRead(userId: string, id: string) { return this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } }); }
  async markAllRead(userId: string) { return this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } }); }
}
