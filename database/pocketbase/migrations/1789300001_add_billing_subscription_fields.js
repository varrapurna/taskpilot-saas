/// <reference path="../pb_data/types.d.ts" />

// PocketBase needs fields to be added to an existing collection explicitly.
// This also repairs local databases that received the collection before its
// schema was available.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  const fields = [
    new RelationField({ name: 'user', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true }),
    new SelectField({ name: 'plan', values: ['starter_monthly'], required: true, maxSelect: 1 }),
    new SelectField({ name: 'status', values: ['trialing', 'active', 'past_due', 'cancelled', 'expired'], required: true, maxSelect: 1 }),
    new DateField({ name: 'trial_started_at' }),
    new DateField({ name: 'trial_ends_at' }),
    new DateField({ name: 'current_period_ends_at' }),
    new BoolField({ name: 'cancel_at_period_end' }),
    new TextField({ name: 'razorpay_customer_id', max: 100, hidden: true }),
    new TextField({ name: 'razorpay_subscription_id', max: 100, hidden: true }),
    new TextField({ name: 'razorpay_plan_id', max: 100, hidden: true }),
    new TextField({ name: 'last_payment_id', max: 100, hidden: true }),
  ];

  for (const field of fields) {
    if (!subscriptions.fields.getByName(field.name)) {
      subscriptions.fields.add(field);
    }
  }

  app.save(subscriptions);
}, (app) => {
  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  for (const name of ['last_payment_id', 'razorpay_plan_id', 'razorpay_subscription_id', 'razorpay_customer_id', 'cancel_at_period_end', 'current_period_ends_at', 'trial_ends_at', 'trial_started_at', 'status', 'plan', 'user']) {
    subscriptions.fields.removeByName(name);
  }
  app.save(subscriptions);
});
