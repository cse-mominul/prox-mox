import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
/** Consistent error format: { statusCode, error, message, path, timestamp } */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private log = new Logger('HTTP');
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse(); const req = host.switchToHttp().getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body: any = exception instanceof HttpException ? exception.getResponse() : null;
    const message = typeof body === 'string' ? body : body?.message || (exception as Error)?.message || 'Internal server error';
    if (status >= 500) this.log.error(`${req.method} ${req.url}`, (exception as Error)?.stack);
    res.status(status).json({ statusCode: status, error: HttpStatus[status] || 'Error', message, path: req.url, timestamp: new Date().toISOString() });
  }
}
