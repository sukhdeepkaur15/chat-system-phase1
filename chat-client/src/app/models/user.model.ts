export interface User {
  id: string;
  username: string;
  email?: string;
  roles: string[]; // e.g., ['super'], ['groupAdmin'], ['user']
  groups: string[]; // array of group IDs the user belongs to
}

