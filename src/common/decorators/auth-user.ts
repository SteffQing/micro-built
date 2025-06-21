import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

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
