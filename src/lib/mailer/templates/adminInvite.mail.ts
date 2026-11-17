export const adminInviteMailTemp = (
  inviterName: string,
  inviteeEmail: string,
  inviteUrl: string,
  roleName: string,
  expiresInHours: number
): string => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">
            <tr>
              <td style="background:#1e293b;padding:24px 32px">
                <span style="color:#ffffff;font-size:18px;font-weight:bold">Megatech</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px">
                <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">You're invited</h2>
                <p style="color:#475569;font-size:14px;line-height:1.6">${inviterName} has invited you (<strong>${inviteeEmail}</strong>) to join the Megatech admin portal as <strong>${roleName}</strong>.</p>
                <p style="margin:24px 0">
                  <a href="${inviteUrl}" style="background:#1e293b;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold">Accept invitation</a>
                </p>
                <p style="color:#475569;font-size:13px;line-height:1.6">This invitation expires in ${expiresInHours} hours. If the button does not work, paste this link into your browser:</p>
                <p style="color:#2563eb;font-size:12px;word-break:break-all">${inviteUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e2e8f0">
                <p style="margin:0;color:#94a3b8;font-size:12px">If you were not expecting this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
