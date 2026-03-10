import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const { method, url } = req;
    const start = performance.now();

    return next.handle().pipe(
      tap(() => {
        const ms = (performance.now() - start).toFixed(0);
        const userLabel = req?.['user']?.id ? ` user=${req['user'].id}` : '';
        console.log(`[API] ${method} ${url} ${userLabel} +${ms}ms`);
      }),
    );
  }
}
