import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!(exception instanceof HttpException)) this.logger.error(exception);
    const detail = exception instanceof HttpException ? exception.getResponse() : 'Lỗi nội bộ máy chủ';
    const message = typeof detail === 'string' ? detail : (detail as any).message || 'Request error';
    res.status(status).json({detail: message, statusCode: status});
  }
}
