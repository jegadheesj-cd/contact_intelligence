export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorDetails: any;

  constructor(message: string, statusCode: number = 500, errorDetails: any = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errorDetails = errorDetails;

    Error.captureStackTrace(this, this.constructor);
  }
}
