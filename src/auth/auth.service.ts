import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, LoginDto, VerifyCodeDto } from './dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { generate6DigitCode, generateId } from 'src/utils';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private redisService: RedisService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) throw new ConflictException('Email already taken');

    const hash = await bcrypt.hash(dto.password, 10);
    const userId = generateId.userId();
    const user = await this.prisma.user.create({
      data: {
        id: userId,
        name: dto.name,
        email: dto.email,
        contact: dto.phone,
        password: hash,
      },
    });

    const code = generate6DigitCode();
    await Promise.all([
      this.redisService.setEx(`verify:${user.email}`, code, 600),
      this.mailService.sendUserSignupVerificationEmail(
        user.email,
        code,
        user.name,
      ),
    ]);

    return {
      message: 'Signup successful. Verification code sent to your email.',
      userId: user.id,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException(
        'User account is inactive! Reach out to support',
      );
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

  async verifyCode(dto: VerifyCodeDto) {
    const { email, code } = dto;
    const storedCode = await this.redisService.get(`verify:${email}`);

    if (!storedCode) {
      throw new UnauthorizedException('Verification code expired');
    }

    if (storedCode !== code) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const user = await this.prisma.user.update({
      where: { email },
      data: {
        status: 'ACTIVE',
        settings: {
          create: {},
        },
      },
    });

    await this.redisService.del(`verify:${email}`);
    return { message: 'User successfully verified', userId: user.id };
  }
}
