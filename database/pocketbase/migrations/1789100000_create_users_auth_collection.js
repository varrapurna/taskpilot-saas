/// <reference path="../pb_data/types.d.ts" />

// Production already has this collection. This migration makes a fresh local
// PocketBase runtime reproducible without changing an existing live database.
migrate((app) => {
  try {
    app.findCollectionByNameOrId('users');
    return;
  } catch {}

  const users = new Collection({
    type: 'auth',
    name: 'users',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new TextField({ name: 'name', required: true, max: 100 }),
      new TextField({ name: 'username', required: true, min: 3, max: 100 }),
    ],
    indexes: ['CREATE UNIQUE INDEX idx_users_username ON users (username)'],
    passwordAuth: { enabled: true, identityFields: ['email', 'username'] },
  });
  app.save(users);
}, (app) => {
  try {
    const users = app.findCollectionByNameOrId('users');
    app.delete(users);
  } catch {}
});
