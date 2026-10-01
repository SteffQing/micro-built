import { applyDecorators } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function ApiUserUnauthorizedResponse() {
  return applyDecorators(
    ApiUnauthorizedResponse({
      description: 'Error: Unauthorized (no session)',
      schema: {
        example: {
          statusCode: 401,
          message: 'Sign in to continue',
          error: 'Unauthorized',
        },
      },
    }),
  );
}

export function ApiUserNotFoundResponse() {
  return applyDecorators(
    ApiNotFoundResponse({
      description: 'User not found',
      schema: {
        example: {
          statusCode: 404,
          message: 'User not found',
          error: 'Not Found',
        },
      },
    }),
  );
}

/** PPI writes need a Customer row; admins have none. */
export function ApiCustomerOnlyResponse() {
  return applyDecorators(
    ApiForbiddenResponse({
      description: 'The signed-in account is not a customer',
      schema: {
        example: {
          statusCode: 403,
          message: 'Only customer accounts can add these details',
          error: 'Forbidden',
        },
      },
    }),
  );
}
