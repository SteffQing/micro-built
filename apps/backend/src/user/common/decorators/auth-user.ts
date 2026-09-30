import { applyDecorators } from '@nestjs/common';
import { ApiNotFoundResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

export function ApiUserUnauthorizedResponse() {
  return applyDecorators(
    ApiUnauthorizedResponse({
      description: 'Error: Unauthorized',
      schema: {
        example: {
          statusCode: 401,
          message: 'Unauthorized',
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
          message: 'User by the provided ID was not found',
          error: 'Not Found',
        },
      },
    }),
  );
}
