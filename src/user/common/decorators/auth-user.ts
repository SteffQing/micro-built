import { applyDecorators } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function ApiUserResponse() {
  return applyDecorators(
    ApiOkResponse({
      description: 'User profile retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Profile data for John Doe has been successfully queried',
          },
          data: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'user-123' },
                  name: { type: 'string', example: 'John Doe' },
                  email: { type: 'string', example: 'john.doe@example.com' },
                  contact: { type: 'string', example: '+1234567890' },
                  role: {
                    type: 'string',
                    enum: ['USER', 'ADMIN', 'MODERATOR'],
                    example: 'USER',
                  },
                  status: {
                    type: 'string',
                    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
                    example: 'ACTIVE',
                  },
                },
              },
            },
          },
        },
      },
    }),
  );
}

type Props = {
  msg: string;
  desc: string;
};
export function ApiUserUnauthorizedResponse(props?: Props) {
  return applyDecorators(
    ApiUnauthorizedResponse({
      description: props?.desc || 'Unauthorized access',
      schema: {
        example: {
          statusCode: 401,
          message: props?.msg || 'Unauthorized',
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
