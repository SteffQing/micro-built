import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, LoginDto, VerifyCodeDto } from './dto';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
export declare class AuthService {
    private prisma;
    private jwtService;
    private mailService;
    private redisService;
    constructor(prisma: PrismaService, jwtService: JwtService, mailService: MailService, redisService: RedisService);
    signup(dto: SignupDto): Promise<{
        message: string;
        userId: string;
    }>;
    login(dto: LoginDto): Promise<{
        token: string;
        user: {
            id: string;
            name: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    }>;
    verifyCode(dto: VerifyCodeDto): Promise<{
        message: string;
        userId: string;
    }>;
}
