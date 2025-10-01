import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private router: Router) {}
  canActivate(): boolean {
    const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const roles: string[] = u?.roles || [];
    const ok = roles.includes('superAdmin') || roles.includes('groupAdmin');
    if (ok) return true;
    this.router.navigate(['/dashboard']);
    return false;
  }
}
