/** Error carrying an HTTP status code; consumed by the global error handler. */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string): HttpError => new HttpError(400, message);
export const unauthorized = (message = 'Unauthorized'): HttpError => new HttpError(401, message);
export const forbidden = (message = 'Forbidden'): HttpError => new HttpError(403, message);
export const notFound = (message = 'Not found'): HttpError => new HttpError(404, message);
export const conflict = (message: string): HttpError => new HttpError(409, message);
export const tooManyRequests = (message = 'Too many requests'): HttpError => new HttpError(429, message);
