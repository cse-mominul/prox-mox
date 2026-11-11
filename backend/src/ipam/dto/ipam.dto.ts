import { IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class PoolDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clusterId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bridge?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() vlan?: number;
  @ApiProperty() @IsString() gateway!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() netmask?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dns?: string;
  @ApiProperty({ example: '203.0.113.10-203.0.113.50', description: 'Range to generate addresses' }) @IsString() range!: string;
}
