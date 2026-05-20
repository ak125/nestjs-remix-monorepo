import { Module } from '@nestjs/common';
import { PositiveSmallIntParamPipe } from './positive-smallint-param.pipe';
import { PositiveIntParamPipe } from './positive-int-param.pipe';

/**
 * Module DI exporté (NON-global) qui rend les typed param pipes
 * résolvables par tout module qui l'importe explicitement.
 *
 * Pourquoi pas @Global() ? Évite collisions DI, dépendances implicites,
 * coupling invisible. Chaque consumer doit déclarer son besoin via
 * `imports: [ParamsPipesModule]`. Promotion vers @Global() seulement
 * si > 5 modules le consomment (mesure empirique post-merge).
 */
@Module({
  providers: [PositiveSmallIntParamPipe, PositiveIntParamPipe],
  exports: [PositiveSmallIntParamPipe, PositiveIntParamPipe],
})
export class ParamsPipesModule {}
