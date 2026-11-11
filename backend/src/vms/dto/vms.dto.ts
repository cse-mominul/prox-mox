import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VmType, BackupMode } from '../../common/types';
export class CreateVmDto {
  @ApiProperty() @IsString() clusterId!: string;
  @ApiPropertyOptional({ description: 'Omit for auto-select least-loaded node' }) @IsOptional() @IsString() node?: string;
  @ApiPropertyOptional({ enum: VmType }) @IsOptional() @IsEnum(VmType) type?: VmType;
  @ApiProperty() @IsString() @Length(1, 80) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() hostname?: string;
  @ApiPropertyOptional({ description: 'Plan id; its vcpu/ram/disk used when explicit sizes omitted' }) @IsOptional() @IsString() planId?: string;
  @ApiPropertyOptional({ description: 'Template VMID to clone (full clone).' }) @IsOptional() @IsInt() cloneFromVmid?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() fullClone?: boolean;
  @ApiPropertyOptional({ description: 'ISO volid e.g. local:iso/debian.iso (fresh install)' }) @IsOptional() @IsString() iso?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(128) vcpu?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(128) ramMb?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) diskGb?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() storage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bridge?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(4094) vlan?: number;
  @ApiPropertyOptional({ description: 'Static IP, "dhcp", or omit to allocate from IP pool' }) @IsOptional() @IsString() ip?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ipPoolId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rootPassword?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sshKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() cloudInit?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() tags?: string[];
}
export class UpdateVmDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(128) vcpu?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(128) ramMb?: number;
  @ApiPropertyOptional({ description: 'Grow-only disk size GB' }) @IsOptional() @IsInt() @Min(1) diskGb?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() bootOrder?: string;
}
export class SnapshotDto { @ApiProperty() @IsString() @Length(1, 60) name!: string; @ApiPropertyOptional() @IsOptional() @IsString() description?: string; @ApiPropertyOptional() @IsOptional() @IsBoolean() vmstate?: boolean; }
export class BackupDto { @ApiPropertyOptional() @IsOptional() @IsString() storage?: string; @ApiPropertyOptional({ enum: BackupMode }) @IsOptional() @IsEnum(BackupMode) mode?: BackupMode; }
export class BackupScheduleDto { @ApiProperty({ example: '0 3 * * *' }) @IsString() cron!: string; @ApiPropertyOptional() @IsOptional() @IsString() storage?: string; @ApiPropertyOptional({ enum: BackupMode }) @IsOptional() @IsEnum(BackupMode) mode?: BackupMode; @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) retention?: number; }
export class RestoreBackupDto { @ApiProperty() @IsString() volid!: string; @ApiPropertyOptional() @IsOptional() @IsString() storage?: string; }
export class IsoMountDto { @ApiProperty({ description: 'ISO volid, empty string unmounts' }) @IsString() iso!: string; }
export class FirewallRuleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dir?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() proto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dport?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dest?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}
export class DeleteVmDto { @ApiProperty({ description: 'Must exactly match VM name (type-to-confirm)' }) @IsString() confirmName!: string; @ApiPropertyOptional() @IsOptional() @IsBoolean() purgeDisks?: boolean; }
export class PasswordDto { @ApiProperty() @IsString() @Length(8, 72) password!: string; }
