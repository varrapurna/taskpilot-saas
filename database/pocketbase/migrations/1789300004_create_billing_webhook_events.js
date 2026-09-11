/// <reference path="../pb_data/types.d.ts" />

// Razorpay can retry the same webhook. Store each provider event ID once so a
// retry cannot update a TaskPilot billing subscription twice.
migrate((app) => {
  try {
    app.findCollectionByNameOrId('billing_webhook_events');
    return;
  } catch {}

  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  const events = new Collection({
    type: 'base',
    name: 'billing_webhook_events',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });
  events.fields.add(new TextField({ name: 'event_id', required: true, max: 100, hidden: true }));
  events.fields.add(new TextField({ name: 'event_type', required: true, max: 100, hidden: true }));
  events.fields.add(new RelationField({ name: 'subscription', collectionId: subscriptions.id, maxSelect: 1, cascadeDelete: false, hidden: true }));
  events.fields.add(new DateField({ name: 'processed_at', required: true, hidden: true }));
  events.indexes.push('CREATE UNIQUE INDEX idx_billing_webhook_events_event_id ON billing_webhook_events (event_id)');
  app.save(events);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('billing_webhook_events'));
  } catch {}
});
