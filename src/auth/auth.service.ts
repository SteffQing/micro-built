import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SignupBodyDto,
  LoginBodyDto,
  VerifyCodeBodyDto,
  ResetPasswordBodyDto,
} from './dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { generateCode, generateId } from 'src/common/utils';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private redisService: RedisService,
  ) {}

  async signup(dto: SignupBodyDto) {
    const email = dto.email;
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) throw new ConflictException('Email already exists');

    const hash = await bcrypt.hash(dto.password, 10);
    const userId = generateId.userId();
    await this.prisma.user.create({
      data: {
        id: userId,
        email,
        password: hash,
      },
    });

    const code = generateCode.sixDigitCode();
    await this.mailService.sendUserSignupVerificationEmail(email, code);
    await this.redisService.setEx(`verify:${email}`, code, 600);

    return {
      message:
        'Signup successful, welcome to MicroBuilt. Verification code has been sent to your email! Please verify to proceed',
      userId,
    };
  }

  async login(dto: LoginBodyDto) {
    const email = dto.email;
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { status: true, id: true, password: true, role: true },
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
      email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        role: user.role,
      },
    };
  }

  async verifySignupCode(dto: VerifyCodeBodyDto) {
    const { email, code } = dto;
    const storedCode = await this.redisService.get(`verify:${email}`);

    if (!storedCode) {
      throw new UnauthorizedException('Verification code expired');
    }

    if (storedCode != code) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const user = await this.prisma.user.update({
      where: { email },
      data: {
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    await this.redisService.del(`verify:${email}`);
    return {
      message: 'You have been successfully verified! Please proceed to login',
      userId: user.id,
    };
  }

  async resendCode(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, identity: { select: { firstName: true } } },
    });
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    const oldCode = await this.redisService.get(`verify:${email}`);
    const newCode = generateCode.sixDigitCode();

    const code = oldCode ?? newCode;
    await this.mailService.sendUserSignupVerificationEmail(
      email,
      code,
      user.identity?.firstName,
    );
    await this.redisService.setEx(`verify:${email}`, code, 600);

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
      select: { identity: { select: { firstName: true } } },
    });
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    const { hashedToken, resetToken } = generateCode.resetToken();

    await this.mailService.sendPasswordResetEmail(
      email,
      resetToken,
      user.identity?.firstName,
    );
    await this.redisService.setEx(`reset:${hashedToken}`, email, 60 * 60);

    return {
      message: 'Password reset instructions sent to your email',
    };
  }

  async resetPassword(dto: ResetPasswordBodyDto) {
    const { token, newPassword } = dto;
    const hashedToken = generateCode.hashToken(token);

    const email = await this.redisService.get(`reset:${hashedToken}`);
    if (!email) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    await this.redisService.del(`reset:${token}`);

    return {
      message: 'Password reset successful',
      email,
    };
  }
}
