/// <reference path="../pb_data/types.d.ts" />

// These collections are server-only. All API rules remain null so the
// encrypted integration credentials and WhatsApp session data cannot be read
// through the public PocketBase API.
migrate((app) => {
  // Earlier manual setup may already have created these collections before
  // this migration reached the server. Treat that state as already migrated,
  // rather than preventing PocketBase from booting with a duplicate-name error.
  let credentialsExists = true;
  try {
    app.findCollectionByNameOrId('credentials');
  } catch {
    credentialsExists = false;
  }

  if (!credentialsExists) {
    const credentials = new Collection({
      type: 'base',
      name: 'credentials',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        new TextField({ name: 'whatsapp_number', required: true, min: 7, max: 20, pattern: '^[0-9]+$' }),
        new TextField({ name: 'display_name', required: true, max: 100 }),
        new TextField({ name: 'taiga_username', required: true, max: 254 }),
        new TextField({ name: 'taiga_password_enc', required: true, max: 0, hidden: true }),
        new TextField({ name: 'taiga_base_url', required: true, max: 2048 }),
      ],
      indexes: ['CREATE UNIQUE INDEX idx_credentials_whatsapp_number ON credentials (whatsapp_number)'],
    });
    app.save(credentials);
  }

  let sessionsExists = true;
  try {
    app.findCollectionByNameOrId('sessions');
  } catch {
    sessionsExists = false;
  }

  if (!sessionsExists) {
    const sessions = new Collection({
      type: 'base',
      name: 'sessions',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        new TextField({ name: 'whatsapp_number', required: true, min: 7, max: 20, pattern: '^[0-9]+$' }),
        new TextField({ name: 'step', required: true, max: 64 }),
        new JSONField({ name: 'data', maxSize: 262144 }),
      ],
      indexes: ['CREATE UNIQUE INDEX idx_sessions_whatsapp_number ON sessions (whatsapp_number)'],
    });
    app.save(sessions);
  }
}, (app) => {
  app.delete(app.findCollectionByNameOrId('sessions'));
  app.delete(app.findCollectionByNameOrId('credentials'));
});
