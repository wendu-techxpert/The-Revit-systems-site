// Previously this markup lived as a template literal inline inside
// authController.requestPasswordReset. Pulling it out means a copy/brand
// change to the reset email no longer requires touching or redeploying
// auth logic (orthogonality) — and gives future emails a single place to
// live instead of growing more inline templates per controller.

export const passwordResetEmailHtml = (resetLink: string): string => `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:8px;">
    <h2 style="color:#d17609;">Password Reset</h2>
    <p>You requested a password reset for your Revit Systems account.</p>
    <p>Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
    <p style="margin:32px 0;">
      <a href="${resetLink}"
         style="background:#d17609;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
        Reset Password
      </a>
    </p>
    <p style="font-size:0.85rem;color:#666;">
      If you did not request this, you can safely ignore this email.<br/>
      The link will expire in 1 hour.
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
    <p style="font-size:0.75rem;color:#aaa;">Revit Systems · revitsystems@gmail.com</p>
  </div>
`;
