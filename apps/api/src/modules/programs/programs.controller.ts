import { Controller, Get, Query } from '@nestjs/common';
import { QueryProgramsDto } from './dto/query-programs.dto.js';
import { ProgramsService } from './programs.service.js';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  findAll(@Query() query: QueryProgramsDto) {
    return this.programs.findAll(query);
  }
}
