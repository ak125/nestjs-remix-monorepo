import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PromptTemplateService } from './prompt-template.service';
import {
  CreatePromptTemplateDto,
  UpdatePromptTemplateDto,
  PromptTemplate,
} from './dto/prompt-template.dto';

@Controller('api/ai-content/prompts')
export class PromptTemplateController {
  constructor(private readonly promptService: PromptTemplateService) {}

  @Get()
  async listTemplates(): Promise<PromptTemplate[]> {
    return this.promptService.listTemplates();
  }

  @Get(':id')
  async getTemplate(@Param('id') id: string): Promise<PromptTemplate> {
    return this.promptService.getTemplate(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(
    @Body() dto: CreatePromptTemplateDto,
  ): Promise<PromptTemplate> {
    return this.promptService.createTemplate(dto);
  }

  @Post(':id')
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdatePromptTemplateDto,
  ): Promise<PromptTemplate> {
    return this.promptService.updateTemplate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Param('id') id: string): Promise<void> {
    return this.promptService.deleteTemplate(id);
  }

  @Post(':id/test')
  async testTemplate(
    @Param('id') id: string,
    @Body() variables: Record<string, any>,
  ): Promise<{ rendered: string }> {
    return this.promptService.testTemplate(id, variables);
  }
}
