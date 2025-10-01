// Expand Role to include both strings you use across the app
export type Role = 'super' | 'superAdmin' | 'groupAdmin' | 'user';

export interface User {
  id: string;
  username: string;
  email: string;
  roles: Role[];
  password?: string; 
}

