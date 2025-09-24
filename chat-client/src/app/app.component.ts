import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule],
  template: `<router-outlet></router-outlet>`,

  styles: [`
    .app-container {
      font-family: Arial, sans-serif;
    }
    header {
      background-color: #007bff;
      color: white;
      padding: 15px;
      text-align: center;
    }
    main {
      padding: 20px;
    }
  `]
})
export class AppComponent implements OnInit {

  ngOnInit(): void {
    // Seed default users if not already stored
    if (!localStorage.getItem('users')) {
      localStorage.setItem('users', JSON.stringify([
        { id: '1', username: 'super',email: 'super@example.com', roles: ['super'], groups: [] },
        { id: '2', username: 'groupadmin', email: 'groupadmin@example.com', roles: ['groupAdmin'], groups: ['Group1'] },
        { id: '3', username: 'user1', email: 'user1@example.com', roles: ['user'], groups: ['Group1'] }
      ]));
    }
  }
}



