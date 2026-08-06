import jwt from 'jsonwebtoken';
import { JwtPayload } from '@/interface/IJwtPayload';

export const fetchUserPermissionsList = (token: string): number[] => {
  if (!token) return [];

  const decodedData = jwt.decode(token) as JwtPayload | null;
  if (!decodedData) return [];

  // This API issues the CSV under "UserPermisssions" (backend's spelling, verbatim);
  // "permissions" is kept as a fallback for tokens following the HRM convention.
  const csv = decodedData.UserPermisssions ?? decodedData.permissions;
  if (!csv) return [];

  return csv
    .split(',')
    .map((permission) => Number(permission))
    .filter((n) => !Number.isNaN(n));
};

export const getInitials = (name?: string | null): string => {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
};
