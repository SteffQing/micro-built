import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, ApiResponse } from '@nestjs/swagger';

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

export function ApiOkResponseWith(dto: Type<unknown>, exampleMessage: string) {
  return applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              data: { $ref: `#/components/schemas/${dto.name}` },
              message: {
                type: 'string',
                example: exampleMessage,
              },
            },
          },
        ],
      },
    }),
  );
}

export function ApiSuccessResponse(
  description: string,
  dataSchema: Record<string, any> | null,
) {
  return applyDecorators(
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        example: {
          message: description,
          data: dataSchema,
        },
      },
    }),
  );
}

export function ApiNullOkResponse(desc: string, msg: string) {
  return applyDecorators(
    ApiOkResponse({
      description: desc,
      schema: {
        example: {
          message: msg,
          data: null,
        },
      },
    }),
  );
}
