/// <reference path="../pb_data/types.d.ts" />

// A user can have only one current billing subscription record. Keeping this
// rule in the database prevents duplicate trials or duplicate subscriptions.
migrate((app) => {
  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  const userIndex = 'CREATE UNIQUE INDEX idx_billing_subscriptions_user ON billing_subscriptions (user)';

  if (!subscriptions.indexes.includes(userIndex)) {
    subscriptions.indexes.push(userIndex);
    app.save(subscriptions);
  }
}, (app) => {
  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  subscriptions.indexes = subscriptions.indexes.filter((index) => !index.includes('idx_billing_subscriptions_user'));
  app.save(subscriptions);
});
