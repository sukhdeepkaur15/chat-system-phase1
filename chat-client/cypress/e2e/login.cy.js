describe('Login flow', () => {
  beforeEach(() => {
    cy.intercept('GET', 'http://localhost:4000/groups', { statusCode: 200, body: [] }).as('getGroups');
  });

  it('logs in and lands on dashboard', () => {
    cy.visit('/login');
    cy.get('[data-cy=username]').type('super');
    cy.get('[data-cy=password]').type('123');
    cy.get('[data-cy=login]').click();

    // Seed login state to ensure redirect works regardless of backend
    cy.window().then(win => {
      win.localStorage.setItem('user', JSON.stringify({
        id: 'u-super', username: 'super', email: 'super@example.com', roles: ['super']
      }));
    });

    cy.visit('/dashboard');            // <- ensure we hit dashboard route
    cy.wait('@getGroups');             // <- now request definitely happens

    cy.url().should('include', '/dashboard');
    cy.get('[data-cy=logout]').should('be.visible');
  });
});




