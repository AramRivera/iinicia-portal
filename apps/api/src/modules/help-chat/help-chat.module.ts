import { Module } from '@nestjs/common';
import { HelpChatController } from './help-chat.controller.js';
import { HelpChatService } from './help-chat.service.js';

@Module({ controllers: [HelpChatController], providers: [HelpChatService] })
export class HelpChatModule {}
