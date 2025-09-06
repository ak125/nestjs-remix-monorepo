import { Module } from '@nestjs/common';
import { LayoutTestController } from './controllers/layout-test.controller';
import { LayoutModule } from './layout.module';

@Module({
  imports: [LayoutModule], // Importe simplement le module Layout principal
  controllers: [LayoutTestController],
  providers: [],
  exports: [],
})
export class LayoutTestModule {}
