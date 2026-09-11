/// <reference path="../pb_data/types.d.ts" />

// PocketBase's default auth emails open its own app URL. TaskPilot owns the
// confirmation screens, so keep the domain environment-specific through
// {APP_URL} and direct each token to the corresponding TaskPilot page.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');

  users.verificationTemplate = {
    subject: 'Verify your {APP_NAME} email',
    body: `<p>Hello,</p>
<p>Thank you for creating your TaskPilot account.</p>
<p><a class="btn" href="{APP_URL}/account/verify?token={TOKEN}" target="_blank" rel="noopener">Verify your email</a></p>
<p>If you did not create a TaskPilot account, you can safely ignore this email.</p>
<p>Thanks,<br>{APP_NAME} team</p>`,
  };

  users.resetPasswordTemplate = {
    subject: 'Reset your {APP_NAME} password',
    body: `<p>Hello,</p>
<p>Use the link below to choose a new TaskPilot password.</p>
<p><a class="btn" href="{APP_URL}/account/reset?token={TOKEN}" target="_blank" rel="noopener">Reset password</a></p>
<p>If you did not request a password reset, you can safely ignore this email.</p>
<p>Thanks,<br>{APP_NAME} team</p>`,
  };

  app.save(users);
}, (app) => {
  // Template content is operational configuration. Keep previously generated
  // email links valid if this migration is ever rolled back.
});
