import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CreateClusterDto {
  @ApiProperty() @IsString() @Length(2, 80) name!: string;
  @ApiProperty({ example: '192.168.1.10' }) @IsString() @Length(1, 253) host!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @ApiProperty({ example: 'root@pam!portal' }) @IsString() tokenId!: string;
  @ApiProperty({ description: 'Token secret (stored AES-256-GCM encrypted, never returned)' }) @IsString() @Length(8, 200) tokenSecret!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() verifyTls?: boolean;
}
export class UpdateClusterDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() host?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() port?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() tokenId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tokenSecret?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() verifyTls?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
}
