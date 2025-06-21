"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const mail_service_1 = require("../mail/mail.service");
const redis_service_1 = require("../redis/redis.service");
const utils_1 = require("../utils");
let AuthService = class AuthService {
    prisma;
    jwtService;
    mailService;
    redisService;
    constructor(prisma, jwtService, mailService, redisService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.mailService = mailService;
        this.redisService = redisService;
    }
    async signup(dto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing)
            throw new common_1.ConflictException('Email already taken');
        const hash = await bcrypt.hash(dto.password, 10);
        const userId = utils_1.generateId.userId();
        const user = await this.prisma.user.create({
            data: {
                id: userId,
                name: dto.name,
                email: dto.email,
                contact: dto.phone,
                password: hash,
            },
        });
        const code = (0, utils_1.generate6DigitCode)();
        await Promise.all([
            this.redisService.setEx(`verify:${user.email}`, code, 600),
            this.mailService.sendUserSignupVerificationEmail(user.email, code, user.name),
        ]);
        return {
            message: 'Signup successful. Verification code sent to your email.',
            userId: user.id,
        };
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const isValid = await bcrypt.compare(dto.password, user.password);
        if (!isValid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (user.status === 'INACTIVE') {
            throw new common_1.UnauthorizedException('User account is inactive! Reach out to support');
        }
        const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
            role: user.role,
        });
        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
            },
        };
    }
    async verifyCode(dto) {
        const { email, code } = dto;
        const storedCode = await this.redisService.get(`verify:${email}`);
        if (!storedCode) {
            throw new common_1.UnauthorizedException('Verification code expired');
        }
        if (storedCode !== code) {
            throw new common_1.UnauthorizedException('Invalid verification code');
        }
        const user = await this.prisma.user.update({
            where: { email },
            data: {
                status: 'ACTIVE',
                settings: {
                    create: {},
                },
            },
            select: { id: true },
        });
        await this.redisService.del(`verify:${email}`);
        return { message: 'User successfully verified', userId: user.id };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        mail_service_1.MailService,
        redis_service_1.RedisService])
], AuthService);
//# sourceMappingURL=auth.service.js.map