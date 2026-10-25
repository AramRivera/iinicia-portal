import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CmsService } from './cms.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';

@Controller()
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('cms/contents')
  findContents(@Query('type') type?: string) {
    return this.cmsService.findPublishedContents(type);
  }

  @Get('cms/contents/:slug')
  findContentBySlug(@Param('slug') slug: string) {
    return this.cmsService.findContentBySlug(slug);
  }

  @Get('directory')
  getDirectory() {
    return this.cmsService.getDirectory();
  }

  @Post('contact')
  @HttpCode(201)
  submitContact(
    @Body() dto: CreateContactMessageDto,
    @Ip() ipAddress: string,
  ) {
    return this.cmsService.submitContactMessage(dto, ipAddress);
  }

  @Get('migration/redirects')
  getRedirects() {
    return this.cmsService.getRedirectsMap();
  }
}
