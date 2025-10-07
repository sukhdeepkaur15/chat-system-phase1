// cypress/e2e/chat-send.cy.js
describe('Send chat message', () => {
  let groups; // in-memory server model

  beforeEach(() => {
    groups = [];

    // GET /groups always returns our in-memory array
    cy.intercept('GET', '**/groups', (req) => {
      req.reply(groups);
    }).as('getGroups');

    // Create group -> push into in-memory array
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

    // Create channel -> add to that group in-memory
    cy.intercept('POST', '**/groups/g1/channels', (req) => {
      const { name } = req.body || {};
      const ch = {
        id: 'c1',
        name: name || 'General',
        members: ['u-super'],
        messages: [],
        bannedUserIds: [],
        bannedUsernames: []
      };
      const g = groups.find(x => x.id === 'g1');
      if (g) g.channels.push(ch);
      req.reply({ statusCode: 201, body: ch });
    }).as('createChannel');

    cy.intercept('GET', '**/messages*', []).as('getMessages');

    // Login
    cy.visit('/login');
    cy.get('[data-cy=username]').type('super');
    cy.get('[data-cy=password]').type('123');
    cy.get('[data-cy=login]').click();

    cy.url().should('include', '/dashboard');
    cy.wait('@getGroups'); // initial fetch (empty)

    // Create group via data-cy hooks
    cy.get('[data-cy=new-group-name]').should('be.visible').type('Demo');
    cy.get('[data-cy=add-group]').scrollIntoView().click({ force: true });
    cy.wait('@createGroup');
    cy.wait('@getGroups'); // refresh after create returns the new group

    // Select the group we just created
    cy.contains('h3', 'Demo', { timeout: 10000 }).click();

    // Create channel
    cy.get('[data-cy=new-channel-name]').should('be.visible').type('General');
    cy.get('[data-cy=add-channel]').scrollIntoView().click({ force: true });
    cy.wait('@createChannel');
    cy.wait('@getGroups'); // group refresh now includes the channel

    // Select channel & get initial messages
    cy.contains('li', 'General', { timeout: 10000 }).click();
    cy.wait('@getMessages');
  });

  it('sends text and shows it', () => {
    // Echo POST /messages
    cy.intercept('POST', '**/messages', (req) => {
      const b = req.body || {};
      req.reply({
        ok: true,
        message: { username: b.username, content: b.content, timestamp: Date.now() }
      });
    }).as('postMessage');

    // After send, app refetches
    cy.intercept('GET', '**/messages*', [{
      username: 'super',
      content: 'hello world',
      timestamp: Date.now()
    }]).as('getMessagesAfter');

    cy.get('[data-cy=message-input]').type('hello world');
    cy.get('[data-cy=send-btn]').click();

    cy.wait('@postMessage');
    cy.wait('@getMessagesAfter');

    cy.get('[data-cy=messages] .chat-message').should('contain.text', 'hello world');
  });
});

