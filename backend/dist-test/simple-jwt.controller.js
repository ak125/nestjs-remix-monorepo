var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SimpleJwtController_1;
import { Controller, Get, Post, UseGuards, Request, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
let SimpleJwtController = SimpleJwtController_1 = class SimpleJwtController {
    constructor(jwtService) {
        this.jwtService = jwtService;
        this.logger = new Logger(SimpleJwtController_1.name);
    }
    async createToken() {
        const payload = {
            sub: 'simple-test-123',
            email: 'simple@test.com',
            role: 'admin'
        };
        this.logger.log('🔑 Création d\'un token de test');
        const token = this.jwtService.sign(payload);
        return {
            success: true,
            token,
            payload,
            usage: `curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/simple-jwt/protected`,
        };
    }
    async protectedEndpoint(req) {
        this.logger.log(`✅ Endpoint protégé accessible ! Utilisateur:`, JSON.stringify(req.user, null, 2));
        return {
            success: true,
            message: 'JWT Authentication FONCTIONNE !',
            user: req.user,
            timestamp: new Date().toISOString(),
        };
    }
    async healthCheck() {
        return {
            status: 'OK',
            service: 'SimpleJwtController',
            timestamp: new Date().toISOString(),
            jwtSecretSet: !!process.env.JWT_SECRET,
        };
    }
};
__decorate([
    Post('create-token'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SimpleJwtController.prototype, "createToken", null);
__decorate([
    Get('protected'),
    UseGuards(AuthGuard('jwt')),
    __param(0, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SimpleJwtController.prototype, "protectedEndpoint", null);
__decorate([
    Get('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SimpleJwtController.prototype, "healthCheck", null);
SimpleJwtController = SimpleJwtController_1 = __decorate([
    Controller('api/simple-jwt'),
    __metadata("design:paramtypes", [JwtService])
], SimpleJwtController);
export { SimpleJwtController };
