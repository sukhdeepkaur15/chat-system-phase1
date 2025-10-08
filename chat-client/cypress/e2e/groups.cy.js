/// <reference types="cypress" />
describe('Groups list', () => {
  beforeEach(() => {
    // wait for dashboard to load its groups
    cy.intercept('GET', '**/groups*').as('groups');

    cy.visit('/login');
    cy.get('[data-cy=username]').type('super');      // <-- use your real creds if different
    cy.get('[data-cy=password]').type('superpass');
    cy.get('[data-cy=login]').click();

    cy.url().should('include', '/dashboard');
    cy.wait('@groups');                              // ensures groups rendered
    cy.get('[data-cy=logout]').should('be.visible'); // stable “logged-in” check
    cy.get('[data-cy=welcome]').should('contain.text', 'Welcome'); // optional
  });

  it('shows groups container', () => {
    cy.get('.groups-in-hero').should('exist').and('be.visible');
  });

  it('opens first group and shows channels', () => {
    cy.get('.groups-in-hero .group-item').first().find('h3').click();
    cy.get('.channels-panel').should('be.visible');
  });
});


