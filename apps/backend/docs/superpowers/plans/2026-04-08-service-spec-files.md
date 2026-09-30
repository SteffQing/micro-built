# Service Spec Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three skeleton spec files for `AuthService`, `ConfigService`, and `UserService` with comprehensive unit tests covering happy paths, thrown exceptions, and key branching logic.

**Architecture:** Each spec file uses `@nestjs/testing` to create an isolated module with all dependencies replaced by `jest.fn()` mocks. No real DB, Redis, or network calls are made. `bcrypt.compare` is patched via `jest.spyOn`. `EventEmitter2.emit` is mocked to assert event names and payloads without firing listeners.

**Tech Stack:** NestJS 11, Jest 29, ts-jest, `@nestjs/testing`, `@nestjs/event-emitter`, Prisma Client (types only), bcrypt

---

### Task 1: `auth.service.spec.ts`

**Files:**
- Modify: `src/auth/auth.service.spec.ts` (replace skeleton entirely)

- [ ] **Step 1: Write the spec**

Replace the entire contents of `src/auth/auth.service.spec.ts` with:

```typescript
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

  afterEach(() => jest.restoreAllMocks());

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
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as any);
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
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as any);
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
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as any);
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
```

- [ ] **Step 2: Run the tests**

```bash
npx jest src/auth/auth.service.spec.ts --no-coverage
```

Expected: all tests pass (green). If a test fails, check the mock setup matches what the service actually calls.

- [ ] **Step 3: Commit**

```bash
git add src/auth/auth.service.spec.ts
git commit -m "test: add AuthService unit tests covering all methods and error branches"
```

---

### Task 2: `config.service.spec.ts`

**Files:**
- Modify: `src/config/config.service.spec.ts` (replace skeleton entirely)

- [ ] **Step 1: Write the spec**

Replace the entire contents of `src/config/config.service.spec.ts` with:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { PrismaService } from 'src/database/prisma.service';

describe('ConfigService', () => {
  let service: ConfigService;
  let prisma: {
    config: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        {
          provide: PrismaService,
          useValue: {
            config: {
              findUnique: jest.fn(),
              upsert: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── getValue ─────────────────────────────────────────────────────────────

  describe('getValue', () => {
    it('returns null when key does not exist in DB', async () => {
      prisma.config.findUnique.mockResolvedValue(null);
      const result = await service.getValue('INTEREST_RATE');
      expect(result).toBeNull();
    });

    it('parses numeric keys as float', async () => {
      prisma.config.findUnique.mockResolvedValue({ key: 'INTEREST_RATE', value: '0.15' });
      const result = await service.getValue('INTEREST_RATE');
      expect(result).toBe(0.15);
    });

    it('parses IN_MAINTENANCE "true" as boolean true', async () => {
      prisma.config.findUnique.mockResolvedValue({ key: 'IN_MAINTENANCE', value: 'true' });
      const result = await service.getValue('IN_MAINTENANCE');
      expect(result).toBe(true);
    });

    it('parses IN_MAINTENANCE "false" as boolean false', async () => {
      prisma.config.findUnique.mockResolvedValue({ key: 'IN_MAINTENANCE', value: 'false' });
      const result = await service.getValue('IN_MAINTENANCE');
      expect(result).toBe(false);
    });

    it('parses COMMODITY_CATEGORIES as trimmed, filtered string array', async () => {
      prisma.config.findUnique.mockResolvedValue({
        key: 'COMMODITY_CATEGORIES',
        value: 'Electronics, Furniture , Vehicles',
      });
      const result = await service.getValue('COMMODITY_CATEGORIES');
      expect(result).toEqual(['Electronics', 'Furniture', 'Vehicles']);
    });

    it('parses LAST_REPAYMENT_DATE as a Date instance', async () => {
      const iso = '2026-04-01T00:00:00.000Z';
      prisma.config.findUnique.mockResolvedValue({ key: 'LAST_REPAYMENT_DATE', value: iso });
      const result = await service.getValue('LAST_REPAYMENT_DATE');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).toISOString()).toBe(iso);
    });
  });

  // ─── inMaintenanceMode ────────────────────────────────────────────────────

  describe('inMaintenanceMode', () => {
    it('returns false when IN_MAINTENANCE is not set', async () => {
      prisma.config.findUnique.mockResolvedValue(null);
      const result = await service.inMaintenanceMode();
      expect(result).toBe(false);
    });

    it('returns true when IN_MAINTENANCE is "true"', async () => {
      prisma.config.findUnique.mockResolvedValue({ key: 'IN_MAINTENANCE', value: 'true' });
      const result = await service.inMaintenanceMode();
      expect(result).toBe(true);
    });

    it('returns cached value on second call within TTL without hitting DB again', async () => {
      prisma.config.findUnique.mockResolvedValue({ key: 'IN_MAINTENANCE', value: 'false' });
      await service.inMaintenanceMode();
      await service.inMaintenanceMode();
      expect(prisma.config.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  // ─── toggleMaintenanceMode ────────────────────────────────────────────────

  describe('toggleMaintenanceMode', () => {
    it('flips from false to true and returns true', async () => {
      prisma.config.findUnique.mockResolvedValue({ key: 'IN_MAINTENANCE', value: 'false' });
      const result = await service.toggleMaintenanceMode();
      expect(result).toBe(true);
      expect(prisma.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ data: { value: 'true' } }),
      );
    });

    it('flips from true to false and returns false', async () => {
      prisma.config.findUnique.mockResolvedValue({ key: 'IN_MAINTENANCE', value: 'true' });
      const result = await service.toggleMaintenanceMode();
      expect(result).toBe(false);
      expect(prisma.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ data: { value: 'false' } }),
      );
    });
  });

  // ─── topupValue ───────────────────────────────────────────────────────────

  describe('topupValue', () => {
    it('reads current value, adds the amount, and writes back', async () => {
      prisma.config.findUnique.mockResolvedValue({ key: 'TOTAL_REPAID', value: '1000' });
      await service.topupValue('TOTAL_REPAID', 500);
      expect(prisma.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ data: { value: '1500' } }),
      );
    });

    it('treats a missing key as 0 and writes the amount directly', async () => {
      prisma.config.findUnique.mockResolvedValue(null);
      await service.topupValue('TOTAL_REPAID', 250);
      expect(prisma.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ data: { value: '250' } }),
      );
    });
  });

  // ─── depleteValue ─────────────────────────────────────────────────────────

  describe('depleteValue', () => {
    it('subtracts the amount from the current value', async () => {
      prisma.config.findUnique.mockResolvedValue({ key: 'BALANCE_OUTSTANDING', value: '500' });
      await service.depleteValue('BALANCE_OUTSTANDING', 200);
      expect(prisma.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ data: { value: '300' } }),
      );
    });

    it('clamps to 0 when subtraction would go negative', async () => {
      prisma.config.findUnique.mockResolvedValue({ key: 'BALANCE_OUTSTANDING', value: '100' });
      await service.depleteValue('BALANCE_OUTSTANDING', 500);
      expect(prisma.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ data: { value: '0' } }),
      );
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx jest src/config/config.service.spec.ts --no-coverage
```

Expected: all tests pass. Note: the cache test relies on both calls completing within the 5 s TTL — this will always be true in a synchronous test run.

- [ ] **Step 3: Commit**

```bash
git add src/config/config.service.spec.ts
git commit -m "test: add ConfigService unit tests covering getValue, cache, toggle, topup, deplete"
```

---

### Task 3: `user.service.spec.ts`

**Files:**
- Modify: `src/user/user.service.spec.ts` (replace skeleton entirely)

- [ ] **Step 1: Write the spec**

Replace the entire contents of `src/user/user.service.spec.ts` with:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { PrismaService } from '../database/prisma.service';
import { SupabaseService } from '../database/supabase.service';
import { Auth } from 'src/queue/events/events';

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    userIdentity: { findUnique: jest.Mock };
    userPaymentMethod: { findUnique: jest.Mock };
    loan: { findMany: jest.Mock };
    repayment: { findMany: jest.Mock };
  };
  let event: { emit: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn().mockResolvedValue({}),
            },
            userIdentity: { findUnique: jest.fn() },
            userPaymentMethod: { findUnique: jest.fn() },
            loan: { findMany: jest.fn().mockResolvedValue([]) },
            repayment: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: SupabaseService,
          useValue: { uploadUserAvatar: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get(PrismaService);
    event = module.get(EventEmitter2);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── getUserById ──────────────────────────────────────────────────────────

  describe('getUserById', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserById('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('returns the user object when found', async () => {
      const mockUser = {
        id: 'u1',
        email: 'john@example.com',
        name: 'John',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        avatar: null,
        contact: null,
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.getUserById('u1');
      expect(result).toEqual(mockUser);
    });
  });

  // ─── updatePassword ───────────────────────────────────────────────────────

  describe('updatePassword', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePassword('missing-id', { oldPassword: 'old', newPassword: 'new' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when old password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hashed' });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as any);
      await expect(
        service.updatePassword('u1', { oldPassword: 'wrongold', newPassword: 'new' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('emits Auth.userUpdatePassword with new password and userId on success', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hashed' });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as any);
      await service.updatePassword('u1', { oldPassword: 'correct', newPassword: 'newpass123' });
      expect(event.emit).toHaveBeenCalledWith(Auth.userUpdatePassword, {
        password: 'newpass123',
        userId: 'u1',
      });
    });
  });

  // ─── getRecentActivities ──────────────────────────────────────────────────

  describe('getRecentActivities', () => {
    it('returns empty array when user has no data at all', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.userIdentity.findUnique.mockResolvedValue(null);
      prisma.userPaymentMethod.findUnique.mockResolvedValue(null);
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.repayment.findMany.mockResolvedValue([]);

      const result = await service.getRecentActivities('u1');
      expect(result).toEqual([]);
    });

    it('aggregates all sources and returns them sorted descending by date', async () => {
      const older = new Date('2026-01-01T00:00:00.000Z');
      const newer = new Date('2026-03-01T00:00:00.000Z');
      const newest = new Date('2026-04-01T00:00:00.000Z');

      prisma.user.findUnique.mockResolvedValue({ createdAt: older, updatedAt: older });
      prisma.userIdentity.findUnique.mockResolvedValue({ createdAt: newer, updatedAt: newer });
      prisma.userPaymentMethod.findUnique.mockResolvedValue(null);
      prisma.loan.findMany.mockResolvedValue([
        {
          principal: 10000,
          status: 'DISBURSED',
          disbursementDate: newest,
          createdAt: newest,
          updatedAt: newest,
        },
      ]);
      prisma.repayment.findMany.mockResolvedValue([]);

      const result = await service.getRecentActivities('u1');

      expect(result.length).toBe(3);
      // sorted newest first
      expect(result[0].date.getTime()).toBeGreaterThanOrEqual(result[1].date.getTime());
      expect(result[1].date.getTime()).toBeGreaterThanOrEqual(result[2].date.getTime());
    });

    it('excludes null sources (missing identity and paymentMethod) from results', async () => {
      prisma.user.findUnique.mockResolvedValue({
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      });
      prisma.userIdentity.findUnique.mockResolvedValue(null);
      prisma.userPaymentMethod.findUnique.mockResolvedValue(null);
      prisma.loan.findMany.mockResolvedValue([]);
      prisma.repayment.findMany.mockResolvedValue([]);

      const result = await service.getRecentActivities('u1');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Profile Activity');
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx jest src/user/user.service.spec.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/user/user.service.spec.ts
git commit -m "test: add UserService unit tests covering getUserById, updatePassword, getRecentActivities"
```
