import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';
import { ApiSuccessResponse } from '@roomcommerce/contracts';

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T> | T>
{
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    return next.handle().pipe(
      map((data) => {
        // Pass through if response is already an envelope or streaming
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          data.success === true
        ) {
          if (!data.meta) {
            data.meta = {
              timestamp: new Date().toISOString(),
              requestId: (request?.headers?.['x-request-id'] as string) || undefined,
            };
          }
          return data;
        }

        const envelope: ApiSuccessResponse<T> = {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (request?.headers?.['x-request-id'] as string) || undefined,
          },
        };

        return envelope;
      }),
    );
  }
}
