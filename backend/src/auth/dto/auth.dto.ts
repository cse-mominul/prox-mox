import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class RegisterDto {
  @ApiProperty() @IsString() @Length(2, 80) name!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'Password must contain letters and numbers' }) password!: string;
}
export class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(1) password!: string;
  @ApiPropertyOptional({ description: 'TOTP code when 2FA enabled' }) @IsOptional() @IsString() totp?: string;
}
export class ForgotDto { @ApiProperty() @IsEmail() email!: string; }
export class ResetDto {
  @ApiProperty() @IsString() token!: string;
  @ApiProperty() @IsString() @MinLength(8) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/) password!: string;
}
export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword!: string;
  @ApiProperty() @IsString() @MinLength(8) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/) newPassword!: string;
}
export class TokenDto { @ApiProperty() @IsString() token!: string; }
export class VerifyTotpDto { @ApiProperty() @IsString() @Length(6, 8) code!: string; }
