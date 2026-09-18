export class ApiResponse<T = undefined> {
  private success: boolean;
  private statusCode: number;
  private message: string;
  private data: T | undefined = undefined;
  private key: undefined | string;

  constructor(statusCode: number, message: string, data?: T, key?: string) {
    this.statusCode = statusCode;
    this.message = message;
    this.success = statusCode < 400;
    if (data) {
      this.data = data;
    }
    this.key = key;
  }
}
