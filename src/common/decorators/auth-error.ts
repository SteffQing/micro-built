import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export function ApiCodeErrorResponse() {
  return applyDecorators(
    ApiResponse({
      status: 401,
      description: 'Provided code/token is invalid or expired',
      content: {
        'application/json': {
          examples: {
            expiredCode: {
              value: {
                statusCode: 401,
                message: 'Verification code expired',
                error: 'Unauthorized',
              },
            },
            invalidCode: {
              value: {
                statusCode: 401,
                message: 'Invalid verification code',
                error: 'Unauthorized',
              },
            },
          },
        },
      },
    }),
  );
}

export function ApiInvalidUserResponse() {
  return applyDecorators(
    ApiResponse({
      status: 401,
      description: 'Invalid credentials or inactive account',
      content: {
        'application/json': {
          examples: {
            invalidCredentials: {
              value: {
                statusCode: 401,
                message: 'Invalid credentials',
                error: 'Unauthorized',
              },
            },
            inactiveAccount: {
              value: {
                statusCode: 401,
                message: 'User account is inactive',
                error: 'Unauthorized',
              },
            },
          },
        },
      },
    }),
  );
}
