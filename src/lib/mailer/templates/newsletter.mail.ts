/**
 * Broadcast newsletter shell. `subject` and `bodyHtml` are already escaped /
 * built by the admin usecase before reaching here; `unsubscribeUrl` is a
 * one-click opt-out carrying the subscriber's token.
 */
export const newsletterMailTemp = (
  subject: string,
  bodyHtml: string,
  unsubscribeUrl: string
): string => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">
            <tr>
              <td style="background:#6d28d9;padding:24px 32px">
                <span style="color:#ffffff;font-size:18px;font-weight:bold">Megatech</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px">
                <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px">${subject}</h2>
                <div style="color:#475569;font-size:14px;line-height:1.7">${bodyHtml}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e2e8f0">
                <p style="margin:0 0 8px;color:#94a3b8;font-size:12px">&copy; ${new Date().getFullYear()} Megatech</p>
                <p style="margin:0;color:#94a3b8;font-size:12px">
                  You are receiving this because you subscribed to our mailing list.
                  <a href="${unsubscribeUrl}" style="color:#7c3aed">Unsubscribe</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
