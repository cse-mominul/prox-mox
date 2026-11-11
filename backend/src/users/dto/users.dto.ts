import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '../../common/types';
export class CreateUserDto {
  @ApiProperty() @IsString() @Length(2, 80) name!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @Length(8, 72) password!: string;
  @ApiPropertyOptional({ enum: Role }) @IsOptional() @IsEnum(Role) role?: Role;
}
export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ enum: Role }) @IsOptional() @IsEnum(Role) role?: Role;
  @ApiPropertyOptional({ enum: UserStatus }) @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
}
export class QuotaDto {
  @ApiProperty() @IsInt() @Min(0) maxVms!: number;
  @ApiProperty() @IsInt() @Min(0) maxVCpu!: number;
  @ApiProperty() @IsInt() @Min(0) maxRamMb!: number;
  @ApiProperty() @IsInt() @Min(0) maxDiskGb!: number;
  @ApiProperty() @IsInt() @Min(0) maxSnapshots!: number;
  @ApiProperty() @IsInt() @Min(0) maxBackups!: number;
  @ApiProperty() @IsInt() @Min(0) maxIps!: number;
}
export class ResetPasswordDto { @ApiProperty() @IsString() @Length(8, 72) password!: string; }
