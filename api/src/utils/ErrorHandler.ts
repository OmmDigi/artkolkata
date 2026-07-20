export class ErrorHandler {
  private statusCode: number;
  private message: string;
  private isOperational: boolean;
  private key: any[];

  constructor(statusCode: number, message: string, key: any[] = []) {
    this.statusCode = statusCode;
    this.message = message;
    this.isOperational = true;
    this.key = key;
  }
}
