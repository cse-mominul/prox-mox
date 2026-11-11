import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class PlanDto {
  @ApiProperty() @IsString() @Length(1, 60) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsInt() @Min(1) vcpu!: number;
  @ApiProperty() @IsInt() @Min(128) ramMb!: number;
  @ApiProperty() @IsInt() @Min(1) diskGb!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() priceMonthly?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
}
