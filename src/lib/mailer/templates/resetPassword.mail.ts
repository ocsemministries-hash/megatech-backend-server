export const resetPasswordMailTemp = (username: string, otp: string, ttlMinutes: number): string => `
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
                <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Hi ${username},</h2>
                <p style="color:#475569;font-size:14px;line-height:1.6">We received a request to reset your Megatech admin password. Enter this code to choose a new one:</p>
                <p style="margin:16px 0;padding:16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;text-align:center">
                  <span style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#0f172a">${otp}</span>
                </p>
                <p style="color:#475569;font-size:13px;line-height:1.6">This code expires in ${ttlMinutes} minutes. If you did not request a password reset, you can safely ignore this email — your current password will stay the same.</p>
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
