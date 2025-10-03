/// <reference types="cypress" />
describe('Login flow', () => {
  it('logs in and lands on dashboard', () => {
    cy.visit('/login');
    cy.get('[data-cy=username]').type('super');
    cy.get('[data-cy=password]').type('superpass');
    cy.get('[data-cy=login]').click();

    cy.url().should('include', '/dashboard');
    cy.get('[data-cy=logout]').should('be.visible');   // <-- stable assertion
  });
});


