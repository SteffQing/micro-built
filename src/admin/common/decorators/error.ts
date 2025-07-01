import { applyDecorators } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';

export function ApiRoleForbiddenResponse() {
  return applyDecorators(
    ApiForbiddenResponse({
      description:
        'Forbidden. User does not have the required roles to access this resource.',
      //   status: HttpStatus.FORBIDDEN,
      schema: {
        example: {
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        },
      },
    }),
  );
}
