export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export const RoleHierarchy = {
  [Role.OWNER]: 4,
  [Role.ADMIN]: 3,
  [Role.EDITOR]: 2,
  [Role.VIEWER]: 1,
};

export const hasPermission = (userRole: Role, requiredRole: Role): boolean => {
  return RoleHierarchy[userRole] >= RoleHierarchy[requiredRole];
};
