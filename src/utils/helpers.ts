import jwt from 'jsonwebtoken';
import { JwtPayload } from '@/interface/IJwtPayload';

export const fetchUserPermissionsList = (token: string): number[] => {
  if (!token) return [];

  const decodedData = jwt.decode(token) as JwtPayload | null;
  if (!decodedData) return [];
  if (!decodedData.permissions) return [];

  return decodedData.permissions
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
