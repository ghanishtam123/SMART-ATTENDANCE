import { PaginationMeta } from '../types/common.types';

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export const getPaginationOptions = (
  page = 1,
  limit = 10,
): PaginationOptions => {
  const normalizedPage = Number.isNaN(page) || page < 1 ? 1 : page;
  const normalizedLimit =
    Number.isNaN(limit) || limit < 1 ? 10 : Math.min(limit, 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
  };
};

export const buildPaginationMeta = (
  totalItems: number,
  page: number,
  limit: number,
): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};
