// IINICIA Portal · contenido institucional · cms.controller.ts
/** Expone por HTTP contenido público, directorio, formulario de contacto y mapa de redirecciones. */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CmsService } from './cms.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';

@Controller()
export class CmsController {
  /** Recibe cmsService como dependencias del módulo de contenido institucional. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly cmsService: CmsService) {}

  /** Lee el contenido institucional publicado y permite acotar la consulta al tipo solicitado. */
  @Get('cms/contents')
  findContents(@Query('type') type?: string) {
    return this.cmsService.findPublishedContents(type);
  }

  /** Resuelve un contenido público por su identificador de enlace para mostrar su detalle. */
  @Get('cms/contents/:slug')
  findContentBySlug(@Param('slug') slug: string) {
    return this.cmsService.findContentBySlug(slug);
  }

  /** Entrega el directorio institucional visible a quienes visitan el portal. */
  @Get('directory')
  getDirectory() {
    return this.cmsService.getDirectory();
  }

  /** Valida el DTO público y pasa el mensaje al servicio que lo registra en la base de datos. */
  @Post('contact')
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  submitContact(
    @Body() dto: CreateContactMessageDto,
    @Ip() ipAddress: string,
  ) {
    return this.cmsService.submitContactMessage(dto, ipAddress);
  }

  /** Expone las equivalencias disponibles para redirigir enlaces de contenidos migrados. */
  @Get('migration/redirects')
  getRedirects() {
    return this.cmsService.getRedirectsMap();
  }
}
