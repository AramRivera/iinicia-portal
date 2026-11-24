// IINICIA Portal · asistente de ayuda · help-chat.controller.ts
/** La entrada pública del chat limita el tamaño de la pregunta, la cantidad de contexto y la frecuencia antes de llamar al proveedor. */
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
  /** Recibe helpChat como dependencias del módulo de asistente de ayuda. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly helpChat: HelpChatService) {}

  /** Recibe la pregunta validada y el contexto acotado para pasarlos al servicio de respuestas. */
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  reply(@Body() dto: HelpQuestionDto) {
    return this.helpChat.reply(dto.question.trim(), dto.previous_questions);
  }
}
