/// <reference path="../pb_data/types.d.ts" />

// Repair migration for production databases that did not receive the original
// MH migration. It is deliberately idempotent: a database with the collections
// already present is left unchanged.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const definitions = [
    {
      name: 'mhconnekt_connections',
      fields: [
        new RelationField({ name: 'user', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true }),
        new TextField({ name: 'whatsapp_number', required: true, min: 7, max: 20, pattern: '^[0-9]+$' }),
        new TextField({ name: 'mh_email', required: true, max: 254, hidden: true }),
        new TextField({ name: 'access_token_enc', required: true, max: 0, hidden: true }),
        new TextField({ name: 'refresh_token_enc', required: true, max: 0, hidden: true }),
        new DateField({ name: 'access_expires_at', required: false, hidden: true }),
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_mhconnekt_connections_user ON mhconnekt_connections (user)',
        'CREATE UNIQUE INDEX idx_mhconnekt_connections_phone ON mhconnekt_connections (whatsapp_number)',
      ],
    },
    {
      name: 'mhconnekt_sessions',
      fields: [
        new TextField({ name: 'whatsapp_number', required: true, min: 7, max: 20, pattern: '^[0-9]+$' }),
        new TextField({ name: 'step', required: true, max: 64 }),
        new JSONField({ name: 'data', maxSize: 262144 }),
      ],
      indexes: ['CREATE UNIQUE INDEX idx_mhconnekt_sessions_phone ON mhconnekt_sessions (whatsapp_number)'],
    },
  ];

  for (const definition of definitions) {
    try { app.findCollectionByNameOrId(definition.name); continue; } catch (_) {}
    app.save(new Collection({ type: 'base', listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null, ...definition }));
  }
}, (app) => {
  // Do not remove live MH data during a rollback of this repair migration.
});
