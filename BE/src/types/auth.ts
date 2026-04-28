export type RoleCode = 'ADMIN' | 'PART_LEADER' | 'EMPLOYEE';

export interface AuthUser {
  id: number;
  employeeId: string;
  employeeNo: string | null;
  username: string;
  fullName: string | null;
  email: string | null;
  partCode: string | null;
  roles: RoleCode[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
