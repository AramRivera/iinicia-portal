// IINICIA Portal · asistente de ayuda · help-chat.module.ts
/** Registra por separado el controlador público del chat y el servicio que consulta al proveedor de respuestas. */
import { Module } from '@nestjs/common';
import { HelpChatController } from './help-chat.controller.js';
import { HelpChatService } from './help-chat.service.js';

@Module({ controllers: [HelpChatController], providers: [HelpChatService] })
export class HelpChatModule {}
