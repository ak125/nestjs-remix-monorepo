import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RagProxyService } from './rag-proxy.service';
import {
  ChatRequestSchema,
  ChatRequestDto,
  ChatResponseDto,
} from './dto/chat.dto';
import {
  SearchRequestSchema,
  SearchRequestDto,
  SearchResponseDto,
} from './dto/search.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('RAG')
@Controller('api/rag')
export class RagProxyController {
  constructor(private readonly ragProxyService: RagProxyService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(ChatRequestSchema))
  @ApiOperation({ summary: 'Chat with RAG assistant' })
  @ApiResponse({ status: 200, description: 'Chat response' })
  @ApiResponse({ status: 503, description: 'RAG service unavailable' })
  async chat(@Body() request: ChatRequestDto): Promise<ChatResponseDto> {
    return this.ragProxyService.chat(request);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(SearchRequestSchema))
  @ApiOperation({ summary: 'Semantic search in knowledge base' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Body() request: SearchRequestDto): Promise<SearchResponseDto> {
    return this.ragProxyService.search(request);
  }

  @Get('health')
  @ApiOperation({ summary: 'Check RAG service health' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async health() {
    return this.ragProxyService.health();
  }
}
