/// <reference path="../pb_data/types.d.ts" />

// Roles are deliberately hidden from normal API responses. Every new account
// is a user; an administrator is assigned only through a private PocketBase
// data update after the account exists.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const credentials = app.findCollectionByNameOrId('credentials');

  if (!users.fields.getByName('role')) {
    users.fields.add(new SelectField({
      name: 'role',
      values: ['user', 'admin'],
      maxSelect: 1,
      required: true,
      hidden: true,
    }));
  }

  if (!users.fields.getByName('last_login_at')) {
    users.fields.add(new DateField({
      name: 'last_login_at',
      hidden: true,
    }));
  }

  // Direct PocketBase requests cannot create accounts, enumerate accounts, or
  // change a role. The TaskPilot server uses its private superuser client for
  // the narrow account operations it owns.
  users.listRule = '@request.auth.role = "admin"';
  users.viewRule = '@request.auth.id = id || @request.auth.role = "admin"';
  users.createRule = null;
  users.updateRule = '@request.auth.id = id && @request.body.role:changed = false';
  users.deleteRule = null;
  users.manageRule = '@request.auth.id = id && @request.body.role:changed = false';
  users.authRule = 'verified = true';
  app.save(users);

  if (!credentials.fields.getByName('user')) {
    credentials.fields.add(new RelationField({
      name: 'user',
      collectionId: users.id,
      maxSelect: 1,
      required: false,
      cascadeDelete: true,
    }));
    app.save(credentials);
  }

  // Accounts created before roles existed stay normal users.
  app.db().newQuery("UPDATE users SET role = 'user' WHERE role = ''").execute();
}, (app) => {
  const users = app.findCollectionByNameOrId('users');
  const credentials = app.findCollectionByNameOrId('credentials');

  users.fields.removeByName('role');
  users.fields.removeByName('last_login_at');
  app.save(users);

  credentials.fields.removeByName('user');
  app.save(credentials);
});
