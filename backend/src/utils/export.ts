import type { Response } from 'express';

import { ApiResponse } from './ApiResponse';

export type ExportFormat = 'json' | 'csv';

export interface ExportColumn {
  key: string;
  label: string;
}

export interface ExportPayload {
  fileName: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  summary?: Record<string, unknown>;
}

const stringifyCsvValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const escapeCsv = (value: unknown): string => {
  const stringValue = stringifyCsvValue(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

export const buildCsvContent = (
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): string => {
  const headerRow = columns.map((column) => escapeCsv(column.label)).join(',');
  const dataRows = rows.map((row) =>
    columns.map((column) => escapeCsv(row[column.key])).join(','),
  );

  return [headerRow, ...dataRows].join('\n');
};

export const sendExportResponse = (
  res: Response,
  format: ExportFormat,
  message: string,
  payload: ExportPayload,
) => {
  if (format === 'csv') {
    res
      .status(200)
      .type('text/csv')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${payload.fileName}.csv"`,
      )
      .send(buildCsvContent(payload.columns, payload.rows));

    return res;
  }

  return ApiResponse.success(res, {
    message,
    data: payload,
  });
};
