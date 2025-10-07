import { Injectable } from '@angular/core';
import { User, Role } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private USERS_KEY = 'users';
  private CURRENT_KEY = 'currentUser';

  private readUsers(): User[] {
    return JSON.parse(localStorage.getItem(this.USERS_KEY) || '[]');
  }
  private writeUsers(users: User[]) {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }
  private writeCurrent(u: User | null) {
    if (u) localStorage.setItem(this.CURRENT_KEY, JSON.stringify(u));
    else localStorage.removeItem(this.CURRENT_KEY);
  }

  // add this helper
updateAvatar(userId: string, url: string) {
  const me = this.getUser();
  if (me && me.id === userId) {
    (me as any).avatarUrl = url;
    localStorage.setItem('auth_user', JSON.stringify(me));
  }
}

  // Seed a super user if none exists
  private ensureSeed() {
    const users = this.readUsers();
    if (!users.some(u => u.username === 'super')) {
      const seed: User = {
        id: 'u-super',
        username: 'super',
        email: 'super@example.com',
        // "super" is allowed (Role includes it)
        roles: ['super'],
        password: 'admin' // optional seed password
      };
      users.push(seed);
      this.writeUsers(users);
    }
  }

  constructor() {
    this.ensureSeed();
  }

  getUser(): User | null {
    const raw = localStorage.getItem(this.CURRENT_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  }

  getAllUsers(): User[] {
    return this.readUsers();
  }

  // ✅ Updated to accept password
  login(username: string, password?: string): boolean {
    const users = this.readUsers();
    const u = users.find(x => x.username === username);
    if (!u) return false;

    // Require password only if user has one stored
    if (u.password && password !== u.password) return false;

    this.writeCurrent(u);
    return true;
  }

  logout() { this.writeCurrent(null); }

  // Accept both "super" and "superAdmin"
  isSuper(): boolean {
    const roles = this.getUser()?.roles || [];
    return roles.includes('super') || roles.includes('superAdmin');
  }
  isGroupAdmin(): boolean {
    const roles = this.getUser()?.roles || [];
    return roles.includes('groupAdmin');
  }

  // Create user with any Role from union
  createUser(username: string, email: string, role: Role = 'user', password?: string): User | null {
    const users = this.readUsers();
    if (users.some(u => u.username === username)) return null;
    const u: User = {
      id: 'u_' + Math.random().toString(36).slice(2, 9),
      username,
      email,
      roles: [role],
      password // optional
    };
    users.push(u);
    this.writeUsers(users);
    return u;
  }

  // Promote using Role (so 'super' | 'superAdmin' | 'groupAdmin' all valid)
  promoteUser(userId: string, role: Role): void {
    const users = this.readUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (!user.roles.includes(role)) user.roles.push(role);
    this.writeUsers(users);

    // If promoting current user, refresh localStorage copy
    const cur = this.getUser();
    if (cur && cur.id === userId) this.writeCurrent(user);
  }

  deleteUser(userId: string): void {
    let users = this.readUsers();
    users = users.filter(u => u.id !== userId);
    this.writeUsers(users);

    const cur = this.getUser();
    if (cur && cur.id === userId) this.logout();
  }
}



