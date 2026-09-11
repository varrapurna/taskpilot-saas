/// <reference path="../pb_data/types.d.ts" />

// A Razorpay subscription ID is created before the customer accepts the
// mandate. Keep a separate private flag that is set only by a verified webhook.
migrate((app) => {
  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  if (!subscriptions.fields.getByName('razorpay_autopay_accepted')) {
    subscriptions.fields.add(new BoolField({ name: 'razorpay_autopay_accepted', hidden: true }));
    app.save(subscriptions);
  }
}, (app) => {
  const subscriptions = app.findCollectionByNameOrId('billing_subscriptions');
  if (subscriptions.fields.getByName('razorpay_autopay_accepted')) {
    subscriptions.fields.removeByName('razorpay_autopay_accepted');
    app.save(subscriptions);
  }
});
