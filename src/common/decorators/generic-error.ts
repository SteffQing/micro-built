import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

type Props = {
  msg: string;
  err: string;
  code: number;
  desc: string;
};
export function ApiGenericErrorResponse({ desc, err, msg, code }: Props) {
  return applyDecorators(
    ApiResponse({
      description: desc,
      status: code,
      schema: {
        example: {
          statusCode: code,
          message: msg,
          error: err,
        },
      },
    }),
  );
}

export function ApiDtoErrorResponse(msg: string | string[]) {
  return applyDecorators(
    ApiResponse({
      description: 'Error: Bad Request',
      status: 400,
      schema: {
        example: {
          statusCode: 400,
          message: Array.isArray(msg) ? msg : [msg],
          error: 'Bad Request',
        },
      },
    }),
  );
}
