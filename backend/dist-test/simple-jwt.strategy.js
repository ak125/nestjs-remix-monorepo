var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SimpleJwtStrategy_1;
import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
let SimpleJwtStrategy = SimpleJwtStrategy_1 = class SimpleJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'test-secret-key-123',
        });
        this.logger = new Logger(SimpleJwtStrategy_1.name);
        this.logger.log('✅ SimpleJwtStrategy créée avec succès');
        this.logger.log(`🔑 Secret utilisé: ${process.env.JWT_SECRET ? 'JWT_SECRET' : 'test-secret-key-123'}`);
    }
    async validate(payload) {
        this.logger.log(`🔍 SimpleJwtStrategy - validate appelé avec:`, JSON.stringify(payload, null, 2));
        // Validation simple pour tous les payloads valides
        if (payload && payload.sub) {
            const user = {
                id: payload.sub,
                email: payload.email || 'unknown@example.com',
                role: payload.role || 'user',
            };
            this.logger.log(`✅ SimpleJwtStrategy - Utilisateur validé:`, JSON.stringify(user, null, 2));
            return user;
        }
        this.logger.warn('❌ SimpleJwtStrategy - Validation échouée - payload invalide');
        return null;
    }
};
SimpleJwtStrategy = SimpleJwtStrategy_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], SimpleJwtStrategy);
export { SimpleJwtStrategy };
