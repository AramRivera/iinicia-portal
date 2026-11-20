import { Body, Controller, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { HelpChatService } from './help-chat.service.js';

export class HelpQuestionDto {
  @IsString()
  @Matches(/\S/u)
  @MaxLength(300)
  question!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @Matches(/\S/u, { each: true })
  @MaxLength(300, { each: true })
  previous_questions?: string[];
}

@Controller('help-chat')
@UseGuards(ThrottlerGuard)
export class HelpChatController {
  constructor(private readonly helpChat: HelpChatService) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  reply(@Body() dto: HelpQuestionDto) {
    return this.helpChat.reply(dto.question.trim(), dto.previous_questions);
  }
}
