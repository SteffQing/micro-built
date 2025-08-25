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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private redisService: RedisService,
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

    const hash = await bcrypt.hash(dto.password, 10);
    const userId = generateId.userId();
    await this.prisma.user.create({
      data: {
        id: userId,
        email,
        contact,
        password: hash,
        name: dto.name,
        status: contact ? 'ACTIVE' : 'INACTIVE',
      },
    });

    const code = generateCode.sixDigitCode();

    if (email) {
      await this.mailService.sendUserSignupVerificationEmail(email, code);
      await this.redisService.setEx(`verify:${email}`, code, 600);
    } else {
      // Assuming you want to support contact-based (e.g., SMS) verification too
      // await this.smsService.sendSignupVerificationSMS(contact!, code);
      // await this.redisService.setEx(`verify:${contact}`, code, 600);
    }

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

    const token = this.jwtService.sign({
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
    const storedCode = await this.redisService.get(`verify:${email}`);

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

    await this.redisService.del(`verify:${email}`);
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

    const oldCode = await this.redisService.get(`verify:${email}`);
    const newCode = generateCode.sixDigitCode();

    const code = oldCode ?? newCode;
    await this.mailService.sendUserSignupVerificationEmail(
      email,
      code,
      user.name,
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
      select: { name: true },
    });
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    const { hashedToken, resetToken } = generateCode.resetToken();

    await this.mailService.sendPasswordResetEmail(email, resetToken, user.name);
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
