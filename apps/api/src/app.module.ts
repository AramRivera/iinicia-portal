import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PermissionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
