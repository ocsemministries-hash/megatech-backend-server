export const welcomeAdminMailTemp = (username: string, loginUrl: string): string => `
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
                <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Welcome, ${username}</h2>
                <p style="color:#475569;font-size:14px;line-height:1.6">Your admin account is now active. You can sign in to the admin portal to start managing content.</p>
                <p style="margin:24px 0">
                  <a href="${loginUrl}" style="background:#1e293b;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold">Sign in</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e2e8f0">
                <p style="margin:0;color:#94a3b8;font-size:12px">&copy; ${new Date().getFullYear()} Megatech</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
