import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiResponse,
  getSchemaPath,
  ApiExtraModels,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { BaseResponseDto, PaginatedResponseDto, MetaDto } from '../dto';

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

export function ApiNullOkResponse(
  desc: string,
  msg: string,
  create: boolean = false,
) {
  if (create)
    return applyDecorators(
      ApiCreatedResponse({
        description: desc,
        schema: {
          example: {
            message: msg,
            data: null,
          },
        },
      }),
    );
  else
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

export const ApiOkBaseResponse = <TModel extends Type<unknown>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(BaseResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseDto) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
};

export const ApiOkPaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model, MetaDto),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
              meta: { $ref: getSchemaPath(MetaDto) },
            },
          },
        ],
      },
    }),
  );
};
