/// <reference path="../pb_data/types.d.ts" />

// A subscription can be waiting for the customer's Razorpay mandate
// authorisation after a trial expires, before it becomes active.
migrate((app) => {
  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  const status = subscriptions.fields.getByName('status');
  status.values = ['trialing', 'pending_authorisation', 'active', 'past_due', 'cancelled', 'expired'];
  app.save(subscriptions);
}, (app) => {
  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  const status = subscriptions.fields.getByName('status');
  status.values = ['trialing', 'active', 'past_due', 'cancelled', 'expired'];
  app.save(subscriptions);
});
