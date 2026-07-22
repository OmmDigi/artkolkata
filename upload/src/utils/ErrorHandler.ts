export class ErrorHandler {
  private statusCode: number;
  private message: string;
  private isOperational: boolean;
  private key: string | undefined;

  constructor(statusCode: number, message: string, key?: string) {
    this.statusCode = statusCode;
    this.message = message;
    this.isOperational = true;
    this.key = key;
  }
}
