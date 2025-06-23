import { applyDecorators } from '@nestjs/common';
import { ApiNotFoundResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

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
