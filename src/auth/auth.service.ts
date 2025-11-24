import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  SignupBodyDto,
  LoginBodyDto,
  VerifyCodeBodyDto,
  ResetPasswordBodyDto,
} from './dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from '../notifications/mail.service';
import { RedisService } from '../database/redis.service';
import { generateCode, generateId } from 'src/common/utils';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Auth } from 'src/queue/events/events';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private redis: RedisService,
    private event: EventEmitter2,
  ) {}

  async signup(dto: SignupBodyDto) {
    const { email, contact } = dto;
    const orConditions = [];

    if (email) orConditions.push({ email });
    if (contact) orConditions.push({ contact });

    if (orConditions.length === 0) {
      throw new BadRequestException('Either email or contact must be provided');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: orConditions,
      },
      select: { email: true },
    });

    if (existing)
      throw new ConflictException(
        existing.email ? 'Email already exists' : 'Contact already exists',
      );

    const userId = generateId.userId();
    this.event.emit(Auth.userSignUp, { ...dto, userId });

    return {
      message: `Signup successful, Welcome to MicroBuilt, ${dto.name}. ${
        email
          ? ' Verification code has been sent to your email! Please verify to proceed'
          : 'Please proceed to login'
      }`,
      userId,
    };
  }

  async login(dto: LoginBodyDto) {
    const { email, contact, password } = dto;
    if (!email && !contact) {
      throw new BadRequestException(
        'Either email or contact must be provided.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: email ? { email } : { contact },
      select: {
        status: true,
        id: true,
        password: true,
        role: true,
        name: true,
      },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    if (user.status === 'INACTIVE') {
      throw new ForbiddenException(
        'Your account is inactive! Please verify or Reach out to support',
      );
    }

    const token = this.jwt.sign({
      sub: user.id,
      email,
      contact,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        role: user.role,
      },
      name: user.name,
    };
  }

  async verifySignupCode(dto: VerifyCodeBodyDto) {
    const { email, code } = dto;
    const storedCode = await this.redis.get(`verify:${email}`);

    if (!storedCode) {
      throw new GoneException('Verification code expired');
    }

    if (storedCode != code) {
      throw new BadRequestException('Invalid verification code');
    }

    const user = await this.prisma.user.update({
      where: { email },
      data: {
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    await this.redis.del(`verify:${email}`);
    return {
      message: 'You have been successfully verified! Please proceed to login',
      userId: user.id,
    };
  }

  async resendCode(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    this.event.emit(Auth.userResendCode, { email, name: user.name });

    return {
      message:
        'Verification code has been re-sent to your email! Please verify to proceed',
      userId: user.id,
    };
  }

  async isValidUser(uid: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { role: true, status: true },
    });
    if (!user)
      throw new NotFoundException('User by the provided ID was not found');
    if (user.status === 'INACTIVE')
      throw new UnauthorizedException(
        'User status is inactive and cannot be signed in',
      );
    return user.role;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { name: true },
    });
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    this.event.emit(Auth.userForgotPassword, { email, name: user.name });

    return {
      message: 'Password reset instructions sent to your email',
    };
  }

  async resetPassword(dto: ResetPasswordBodyDto) {
    const hashedToken = generateCode.hashToken(dto.token);

    const email = await this.redis.get(`reset:${hashedToken}`);
    if (!email) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    this.event.emit(Auth.userResetPassword, { ...dto, email });

    return {
      message: 'Password reset successful',
      email,
    };
  }
}
