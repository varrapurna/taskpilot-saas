/// <reference path="../pb_data/types.d.ts" />

// Store only the billing facts needed by the private TaskPilot admin report.
// Raw Razorpay payloads can contain unnecessary customer data, so they are not
// kept in PocketBase.
migrate((app) => {
  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  const events = app.findCollectionByNameOrId('billing_webhook_events');

  if (!subscriptions.fields.getByName('cancelled_at')) {
    subscriptions.fields.add(new DateField({ name: 'cancelled_at', hidden: true }));
    app.save(subscriptions);
  }

  const fields = [
    new TextField({ name: 'event_source', max: 30, hidden: true }),
    new TextField({ name: 'payment_id', max: 100, hidden: true }),
    new TextField({ name: 'invoice_id', max: 100, hidden: true }),
    new NumberField({ name: 'amount', min: 0, hidden: true }),
    new TextField({ name: 'currency', max: 10, hidden: true }),
    new TextField({ name: 'payment_status', max: 50, hidden: true }),
    new DateField({ name: 'occurred_at', hidden: true }),
    new TextField({ name: 'failure_reason', max: 500, hidden: true }),
  ];

  for (const field of fields) {
    if (!events.fields.getByName(field.name)) events.fields.add(field);
  }
  if (!events.indexes.some((index) => index.includes('idx_billing_events_subscription_time'))) {
    events.indexes.push('CREATE INDEX idx_billing_events_subscription_time ON billing_webhook_events (subscription, occurred_at)');
  }
  app.save(events);
}, (app) => {
  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  const events = app.findCollectionByNameOrId('billing_webhook_events');

  if (subscriptions.fields.getByName('cancelled_at')) subscriptions.fields.removeByName('cancelled_at');
  app.save(subscriptions);

  for (const name of ['failure_reason', 'occurred_at', 'payment_status', 'currency', 'amount', 'invoice_id', 'payment_id', 'event_source']) {
    if (events.fields.getByName(name)) events.fields.removeByName(name);
  }
  events.indexes = events.indexes.filter((index) => !index.includes('idx_billing_events_subscription_time'));
  app.save(events);
});
