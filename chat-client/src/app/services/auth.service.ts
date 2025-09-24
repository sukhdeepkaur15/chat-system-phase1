import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/user.model';
import { v4 as uuidv4 } from 'uuid'; // for unique IDs

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private users: User[] = [];

  private currentUser: User | null = null;

  constructor(private router: Router) {
    // Load users from localStorage or create default super admin
    const storedUsers = localStorage.getItem('users');
    if (storedUsers) {
      this.users = JSON.parse(storedUsers);
    } else {
      const superAdmin: User = {
        id: uuidv4(),
        username: 'super',
        email: 'super@chat.com',
        roles: ['super'],
        groups: []
      };
      this.users = [superAdmin];
      this.save();
    }
  }

  // Save users to localStorage
  private save() {
    localStorage.setItem('users', JSON.stringify(this.users));
  }

  // Login
  login(username: string, password: string): boolean {
    const user = this.users.find(u => u.username === username);
    if (user && password === '123') { // simple password for assignment
      this.currentUser = user;
      localStorage.setItem('currentUser', JSON.stringify(user));
      return true;
    }
    return false;
  }

  // Logout
  logout(): void {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    this.router.navigate(['/login']);
  }

  // Get logged in user
  getUser(): User | null {
    if (!this.currentUser) {
      this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    }
    return this.currentUser;
  }

  // Check roles
  isSuper(): boolean {
    return this.getUser()?.roles.includes('super') || false;
  }

  isGroupAdmin(): boolean {
    return this.getUser()?.roles.includes('groupAdmin') || false;
  }

  // Create new user
createUser(username: string, email: string, role: 'user' | 'groupAdmin' | 'super'): User {
  const user: User = {
    id: uuidv4(),
    username,
    email,
    roles: [role],
    groups: []
  };
  const users = this.getAllUsers();
  users.push(user);
  localStorage.setItem('users', JSON.stringify(users));
  return user;
}


  // Promote user to groupAdmin or super
  promoteUser(userId: string, role: 'groupAdmin' | 'super'): boolean {
    const user = this.users.find(u => u.id === userId);
    if (!user) return false;
    if (!user.roles.includes(role)) user.roles.push(role);
    this.save();
    return true;
  }

  // Delete user
  deleteUser(userId: string): boolean {
    const index = this.users.findIndex(u => u.id === userId);
    if (index === -1) return false;
    this.users.splice(index, 1);
    this.save();
    return true;
  }

  // Add user to a group
  addUserToGroup(userId: string, groupId: string): boolean {
    const user = this.users.find(u => u.id === userId);
    if (!user) return false;
    if (!user.groups.includes(groupId)) user.groups.push(groupId);
    this.save();
    return true;
  }

  // Remove user from a group
  removeUserFromGroup(userId: string, groupId: string): boolean {
    const user = this.users.find(u => u.id === userId);
    if (!user) return false;
    user.groups = user.groups.filter(g => g !== groupId);
    this.save();
    return true;
  }

  // Get all users
  getAllUsers(): User[] {
    return this.users;
  }
}

