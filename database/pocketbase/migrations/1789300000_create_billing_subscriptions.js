/// <reference path="../pb_data/types.d.ts" />

// Billing data is private server state. Razorpay identifiers and subscription
// status must never be readable or editable through the public PocketBase API.
migrate((app) => {
  try {
    app.findCollectionByNameOrId('billing_subscriptions');
    return;
  } catch {}

  const users = app.findCollectionByNameOrId('users');
  const subscriptions = new Collection({
    type: 'base',
    name: 'billing_subscriptions',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      new RelationField({ name: 'user', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
      new SelectField({
        name: 'plan',
        values: ['starter_monthly'],
        required: true,
        maxSelect: 1,
      }),
      new SelectField({
        name: 'status',
        values: ['trialing', 'active', 'past_due', 'cancelled', 'expired'],
        required: true,
        maxSelect: 1,
      }),
      new DateField({ name: 'trial_started_at' }),
      new DateField({ name: 'trial_ends_at' }),
      new DateField({ name: 'current_period_ends_at' }),
      new BoolField({ name: 'cancel_at_period_end' }),
      new TextField({ name: 'razorpay_customer_id', max: 100, hidden: true }),
      new TextField({ name: 'razorpay_subscription_id', max: 100, hidden: true }),
      new TextField({ name: 'razorpay_plan_id', max: 100, hidden: true }),
      new TextField({ name: 'last_payment_id', max: 100, hidden: true }),
    ],
    indexes: ['CREATE UNIQUE INDEX idx_billing_subscriptions_user ON billing_subscriptions (user)'],
  });

  app.save(subscriptions);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('billing_subscriptions'));
  } catch {}
});
