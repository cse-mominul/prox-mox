import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VmsService } from './vms.service';
import { CreateVmDto, UpdateVmDto, SnapshotDto, BackupDto, BackupScheduleDto, RestoreBackupDto, IsoMountDto, FirewallRuleDto, DeleteVmDto, PasswordDto } from './dto/vms.dto';
import { CurrentUser, AuthUser, ClientIp } from '../common/decorators';
@ApiTags('vms') @ApiBearerAuth() @Controller('vms')
export class VmsController {
  constructor(private vms: VmsService) {}
  @Post() create(@Body() dto: CreateVmDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.vms.create(dto, u, ip); }
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: Record<string, string>) { return this.vms.list(u, q as never); }
  @Get(':id') detail(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.vms.detail(id, u); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateVmDto, @CurrentUser() u: AuthUser) { return this.vms.update(id, dto, u); }
  @Delete(':id') remove(@Param('id') id: string, @Body() dto: DeleteVmDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.vms.softDelete(id, dto.confirmName, !!dto.purgeDisks, u, ip); }
  @Post(':id/restore-deleted') restoreDeleted(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.vms.restoreDeleted(id, u); }
  @Post(':id/start') start(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.vms.action(id, 'start', u, ip); }
  @Post(':id/stop') stop(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.vms.action(id, 'stop', u, ip); }
  @Post(':id/shutdown') shutdown(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.vms.action(id, 'shutdown', u, ip); }
  @Post(':id/reboot') reboot(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.vms.action(id, 'reboot', u, ip); }
  @Post(':id/reset') reset(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.vms.action(id, 'reset', u, ip); }
  @Post(':id/suspend') suspend(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.vms.action(id, 'suspend', u, ip); }
  @Post(':id/resume') resume(@Param('id') id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.vms.action(id, 'resume', u, ip); }
  @Post(':id/iso') iso(@Param('id') id: string, @Body() dto: IsoMountDto, @CurrentUser() u: AuthUser) { return this.vms.mountIso(id, dto.iso, u); }
  @Get(':id/metrics') metrics(@Param('id') id: string, @Query('timeframe') tf: string, @CurrentUser() u: AuthUser) { return this.vms.metrics(id, tf || 'hour', u); }
  @Get(':id/console') console(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.vms.consoleTicket(id, u); }
  @Post(':id/reset-password') resetPw(@Param('id') id: string, @Body() dto: PasswordDto, @CurrentUser() u: AuthUser) { return this.vms.resetPassword(id, dto.password, u); }
  @Post(':id/reinstall') reinstall(@Param('id') id: string, @Body() dto: { templateVmid?: number; iso?: string }, @CurrentUser() u: AuthUser) { return this.vms.reinstall(id, dto, u); }
  // Snapshots
  @Get(':id/snapshots') snaps(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.vms.listSnapshots(id, u); }
  @Post(':id/snapshots') snap(@Param('id') id: string, @Body() dto: SnapshotDto, @CurrentUser() u: AuthUser) { return this.vms.createSnapshot(id, dto, u); }
  @Post(':id/snapshots/:name/rollback') snapRb(@Param('id') id: string, @Param('name') name: string, @CurrentUser() u: AuthUser) { return this.vms.rollbackSnapshot(id, name, u); }
  @Delete(':id/snapshots/:name') snapDel(@Param('id') id: string, @Param('name') name: string, @CurrentUser() u: AuthUser) { return this.vms.deleteSnapshot(id, name, u); }
  // Backups
  @Get(':id/backups') backups(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.vms.listBackups(id, u); }
  @Post(':id/backups') backup(@Param('id') id: string, @Body() dto: BackupDto, @CurrentUser() u: AuthUser) { return this.vms.createBackup(id, dto as never, u); }
  @Delete(':id/backups/:backupId') backupDel(@Param('id') id: string, @Param('backupId') bid: string, @CurrentUser() u: AuthUser) { return this.vms.deleteBackup(id, bid, u); }
  @Post(':id/backups/restore') backupRestore(@Param('id') id: string, @Body() dto: RestoreBackupDto, @CurrentUser() u: AuthUser) { return this.vms.restoreBackup(id, dto, u); }
  @Get(':id/backup-schedules') schedules(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.vms.listSchedules(id, u); }
  @Post(':id/backup-schedules') schedule(@Param('id') id: string, @Body() dto: BackupScheduleDto, @CurrentUser() u: AuthUser) { return this.vms.scheduleBackup(id, dto as never, u); }
  // Firewall
  @Get(':id/firewall') fw(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.vms.listFirewall(id, u); }
  @Post(':id/firewall') fwAdd(@Param('id') id: string, @Body() dto: FirewallRuleDto, @CurrentUser() u: AuthUser) { return this.vms.addFirewall(id, dto as Record<string, unknown>, u); }
  @Delete(':id/firewall/:ruleId') fwDel(@Param('id') id: string, @Param('ruleId') rid: string, @CurrentUser() u: AuthUser) { return this.vms.deleteFirewall(id, rid, u); }
}
