import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../database/redis.service';
import { Auth } from 'src/queue/events/events';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  genSalt: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let redis: { get: jest.Mock; del: jest.Mock; setEx: jest.Mock };
  let event: { emit: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock.jwt.token') },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            del: jest.fn().mockResolvedValue(1),
            setEx: jest.fn().mockResolvedValue('OK'),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    event = module.get(EventEmitter2);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── signup ───────────────────────────────────────────────────────────────

  describe('signup', () => {
    it('throws BadRequestException when neither email nor contact is provided', async () => {
      await expect(
        service.signup({ name: 'John', password: 'pass123' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('throws ConflictException with "Email already exists" when email is taken', async () => {
      prisma.user.findFirst.mockResolvedValue({ email: 'taken@example.com' });
      await expect(
        service.signup({ email: 'taken@example.com', name: 'John', password: 'pass123' } as any),
      ).rejects.toThrow(new ConflictException('Email already exists'));
    });

    it('throws ConflictException with "Contact already exists" when contact is taken', async () => {
      prisma.user.findFirst.mockResolvedValue({ email: null });
      await expect(
        service.signup({ contact: '08012345678', name: 'John', password: 'pass123' } as any),
      ).rejects.toThrow(new ConflictException('Contact already exists'));
    });

    it('emits Auth.userSignUp and returns message + userId on success', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const result = await service.signup({
        email: 'new@example.com',
        name: 'John',
        password: 'pass123',
      } as any);
      expect(event.emit).toHaveBeenCalledWith(
        Auth.userSignUp,
        expect.objectContaining({ email: 'new@example.com', name: 'John' }),
      );
      expect(result).toMatchObject({
        message: expect.any(String),
        userId: expect.stringMatching(/^MB-/),
      });
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws BadRequestException when neither email nor contact is provided', async () => {
      await expect(
        service.login({ password: 'pass' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@example.com', password: 'pass' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        password: 'hashed',
        status: 'ACTIVE',
        role: 'CUSTOMER',
        name: 'John',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login({ email: 'john@example.com', password: 'wrongpass' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when user account is INACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        password: 'hashed',
        status: 'INACTIVE',
        role: 'CUSTOMER',
        name: 'John',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(
        service.login({ email: 'john@example.com', password: 'pass' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns token, user, and name on success', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        password: 'hashed',
        status: 'ACTIVE',
        role: 'CUSTOMER',
        name: 'John',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await service.login({
        email: 'john@example.com',
        password: 'pass',
      } as any);
      expect(result).toEqual({
        token: 'mock.jwt.token',
        user: { id: 'u1', role: 'CUSTOMER' },
        name: 'John',
      });
    });
  });

  // ─── verifySignupCode ─────────────────────────────────────────────────────

  describe('verifySignupCode', () => {
    it('throws GoneException when Redis has no code for that email', async () => {
      redis.get.mockResolvedValue(null);
      await expect(
        service.verifySignupCode({ email: 'a@b.com', code: '123456' }),
      ).rejects.toThrow(GoneException);
    });

    it('throws BadRequestException when code does not match', async () => {
      redis.get.mockResolvedValue('111111');
      await expect(
        service.verifySignupCode({ email: 'a@b.com', code: '999999' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates status to FLAGGED, deletes Redis key, returns userId on success', async () => {
      redis.get.mockResolvedValue('123456');
      prisma.user.update.mockResolvedValue({ id: 'u1' });

      const result = await service.verifySignupCode({ email: 'a@b.com', code: '123456' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'FLAGGED' } }),
      );
      expect(redis.del).toHaveBeenCalledWith('verify:a@b.com');
      expect(result).toMatchObject({ userId: 'u1', message: expect.any(String) });
    });
  });

  // ─── resendCode ───────────────────────────────────────────────────────────

  describe('resendCode', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resendCode('nobody@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('emits Auth.userResendCode and returns userId on success', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'John' });
      const result = await service.resendCode('john@example.com');
      expect(event.emit).toHaveBeenCalledWith(
        Auth.userResendCode,
        expect.objectContaining({ email: 'john@example.com', name: 'John' }),
      );
      expect(result).toMatchObject({ userId: 'u1' });
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.forgotPassword('nobody@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('emits Auth.userForgotPassword on success', async () => {
      prisma.user.findUnique.mockResolvedValue({ name: 'John' });
      const result = await service.forgotPassword('john@example.com');
      expect(event.emit).toHaveBeenCalledWith(
        Auth.userForgotPassword,
        expect.objectContaining({ email: 'john@example.com', name: 'John' }),
      );
      expect(result).toMatchObject({ message: expect.any(String) });
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('throws UnauthorizedException when reset token is invalid or expired', async () => {
      redis.get.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'Newpass1!' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('emits Auth.userResetPassword and returns email on success', async () => {
      redis.get.mockResolvedValue('john@example.com');
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'john@example.com', password: 'old' });

      const result = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'Newpass1!',
      } as any);

      expect(event.emit).toHaveBeenCalledWith(
        Auth.userResetPassword,
        expect.objectContaining({ email: 'john@example.com' }),
      );
      expect(result).toEqual({ message: 'Password reset successful', email: 'john@example.com' });
    });
  });
});
