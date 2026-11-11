import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateTicketDto { @ApiProperty() @IsString() @Length(3, 160) subject!: string; @ApiProperty() @IsString() @Length(1, 5000) body!: string; }
export class ReplyDto { @ApiProperty() @IsString() @Length(1, 5000) body!: string; }
