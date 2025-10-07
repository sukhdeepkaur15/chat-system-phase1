// cypress/e2e/chat-upload.cy.js
describe('Upload chat image', () => {
  let groups;

  beforeEach(() => {
    groups = [];

    // Serve current groups from in-memory array
    cy.intercept('GET', '**/groups', (req) => {
      req.reply(groups);
    }).as('getGroups');

    // Create group -> push to memory
    cy.intercept('POST', '**/groups', (req) => {
      const { name, creatorId } = req.body || {};
      const g = {
        id: 'g1',
        name: name || 'Demo',
        creatorId: creatorId || 'u-super',
        users: [creatorId || 'u-super'],
        joinRequests: [],
        channels: []
      };
      groups.push(g);
      req.reply({ statusCode: 201, body: g });
    }).as('createGroup');

    // Create channel -> push to group
    cy.intercept('POST', '**/groups/g1/channels', (req) => {
      const { name } = req.body || {};
      const ch = {
        id: 'c1',
        name: name || 'General',
        members: ['u-super'],
        messages: []
      };
      const g = groups.find(x => x.id === 'g1');
      if (g) g.channels.push(ch);
      req.reply({ statusCode: 201, body: ch });
    }).as('createChannel');

    // ✅ Initial messages (first load after selecting channel)
    cy.intercept('GET', '**/messages*', []).as('getMessagesInitial');

    // Stub uploads
    cy.intercept('POST', '**/upload/avatar', { ok: true }).as('uploadAvatar');
    cy.intercept('POST', '**/upload/chat', { ok: true, imageUrl: '/uploads/chat/fake.png' }).as('uploadChat');

    // Login
    cy.visit('/login');
    cy.get('[data-cy=username]').type('super');
    cy.get('[data-cy=password]').type('123');
    cy.get('[data-cy=login]').click();

    cy.url().should('include', '/dashboard');
    cy.wait('@getGroups'); // empty list initially

    // Create group & channel via stable hooks
    cy.get('[data-cy=new-group-name]').should('be.visible').type('Demo');
    cy.get('[data-cy=add-group]').scrollIntoView().click({ force: true });
    cy.wait('@createGroup');
    cy.wait('@getGroups'); // now contains Demo

    cy.contains('h3', 'Demo', { timeout: 10000 }).click();

    cy.get('[data-cy=new-channel-name]').should('be.visible').type('General');
    cy.get('[data-cy=add-channel]').scrollIntoView().click({ force: true });
    cy.wait('@createChannel');
    cy.wait('@getGroups'); // Demo now has General

    cy.contains('li', 'General', { timeout: 10000 }).click();

    // Wait for the FIRST messages fetch using the initial alias
    cy.wait('@getMessagesInitial');
  });

  it('stubs /upload/chat and shows the image in the chat', () => {
    // Register the "after upload" intercept ONLY now, so it doesn't override the initial one
    cy.intercept('GET', '**/messages*', [{
      username: 'super',
      imageUrl: '/uploads/chat/fake.png',
      timestamp: Date.now()
    }]).as('getMessagesAfterUpload');

    // Wait for messages and for the chat upload input to render
    cy.wait('@getMessages');
    cy.get('[data-cy=chat-upload]', { timeout: 10000 }).should('be.visible');

    // Single chat-upload input (you removed the duplicate block)
    cy.get('[data-cy=chat-upload]')
      .selectFile('cypress/fixtures/example.png', { force: true });

    cy.wait('@uploadChat');
    cy.wait('@getMessagesAfterUpload');

    cy.get('[data-cy=messages] img.chat-image', { timeout: 10000 })
      .should('have.attr', 'src')
      .and('include', '/uploads/chat/');

  });
});



