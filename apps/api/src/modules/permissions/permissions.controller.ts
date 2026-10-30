// apps/api/src/modules/permissions/permissions.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard.js';
import type { AuthenticatedRequest } from '../../common/auth/supabase-auth.guard.js';
import { PermissionsService } from './permissions.service.js';
import { QueryPermissionsDto } from './dto/query-permissions.dto.js';

@Controller('permissions')
@UseGuards(SupabaseAuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  findAll(
    @Query() query: QueryPermissionsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.permissionsService.findAll(query, request.accessToken);
  }
}
