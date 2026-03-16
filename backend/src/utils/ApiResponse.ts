import { Response } from 'express';

import { HTTP_STATUS } from '../constants/http';

interface SuccessOptions<T> {
  statusCode?: number;
  message: string;
  data?: T;
  meta?: object;
}

interface ErrorOptions {
  statusCode?: number;
  message: string;
  error?: unknown;
  meta?: object;
}

export class ApiResponse<T> {
  constructor(
    public readonly success: boolean,
    public readonly message: string,
    public readonly data?: T,
    public readonly error?: unknown,
    public readonly meta?: object,
  ) {}

  static success<T>(res: Response, options: SuccessOptions<T>): Response {
    const {
      statusCode = HTTP_STATUS.OK,
      message,
      data,
      meta,
    } = options;

    return res
      .status(statusCode)
      .json(new ApiResponse<T>(true, message, data, undefined, meta));
  }

  static error(res: Response, options: ErrorOptions): Response {
    const {
      statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message,
      error,
      meta,
    } = options;

    return res
      .status(statusCode)
      .json(new ApiResponse(false, message, undefined, error, meta));
  }
}
