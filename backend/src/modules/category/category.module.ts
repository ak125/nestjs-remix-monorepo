/**
 * 🗂️ MODULE CATÉGORIES
 *
 * Module NestJS pour les pages catégories dynamiques
 */

import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategorySimpleService } from './category-simple.service';
import { CategoryContentServiceReal } from './category-content-real.service';
import { DatabaseModule } from '../../database/database.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [DatabaseModule, ProductsModule],
  controllers: [CategoryController],
  providers: [CategorySimpleService, CategoryContentServiceReal],
  exports: [CategorySimpleService, CategoryContentServiceReal],
})
export class CategoryModule {}