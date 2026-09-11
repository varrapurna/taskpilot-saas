/// <reference path="../pb_data/types.d.ts" />

// Restore TaskPilot's branded verification email after the link was moved from
// PocketBase's localhost confirmation page to the TaskPilot website.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');

  users.verificationTemplate = {
    subject: 'Verify your TaskPilot email',
    body: `<div style="margin:0;padding:40px 20px;background:#f4f6f3;font-family:Arial,sans-serif;color:#172018;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e1e6df;border-radius:18px;overflow:hidden;">
    <tr>
      <td style="padding:48px 46px 34px;">
        <div style="margin:0 0 42px;font-size:29px;line-height:1;font-weight:800;letter-spacing:-1.5px;color:#172018;">Task<span style="color:#a91e3b;">Pilot</span></div>
        <h1 style="margin:0 0 20px;font-size:34px;line-height:1.15;letter-spacing:-1px;color:#172018;">Verify your email</h1>
        <p style="margin:0 0 32px;font-size:18px;line-height:1.6;color:#4f5b51;">Thanks for creating your TaskPilot account. Confirm your email address to get started.</p>
        <a href="{APP_URL}/account/verify?token={TOKEN}" target="_blank" rel="noopener" style="display:inline-block;border-radius:10px;padding:17px 27px;background:#a91e3b;color:#ffffff;font-size:17px;font-weight:700;line-height:1;text-decoration:none;">Verify email</a>
      </td>
    </tr>
    <tr>
      <td style="border-top:1px solid #e1e6df;padding:25px 46px;color:#69746a;font-size:14px;line-height:1.5;">If you did not create a TaskPilot account, you can safely ignore this email.</td>
    </tr>
  </table>
</div>`,
  };

  app.save(users);
}, (app) => {
  // Keep the active branded template unchanged if the migration is rolled back.
});
