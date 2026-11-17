import type { NextFunction, Request, Response } from 'express';
import { NewsletterUsecases } from './newsletter.usecases';
import { toSubscriberReceiptDto } from './newsletter.output';
import type { SubscribeDto, UnsubscribeDto } from './validation.schema';

/** Minimal confirmation page for the tokenised unsubscribe link in emails. */
const unsubscribePage = (ok: boolean): string => `
<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Mailing list</title></head>
  <body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f5">
    <main style="max-width:480px;margin:80px auto;background:#fff;border-radius:12px;padding:40px;text-align:center">
      <h1 style="margin:0 0 12px;color:#0f172a;font-size:20px">
        ${ok ? 'You have been unsubscribed' : 'Link not recognised'}
      </h1>
      <p style="color:#475569;font-size:14px;line-height:1.6">
        ${
          ok
            ? 'You will no longer receive our mailing-list emails. You can subscribe again from the website at any time.'
            : 'This unsubscribe link is invalid or has already been used.'
        }
      </p>
    </main>
  </body>
</html>
`;

export class NewsletterController {
  constructor(private readonly newsletter: NewsletterUsecases = new NewsletterUsecases()) {}

  /** Public signup (optional auth already ran): 201 + receipt. */
  subscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as SubscribeDto;
      const row = await this.newsletter.subscribe(
        body,
        req.user ? { id: req.user.id, email: req.user.email } : null
      );
      res.status(201).json({ success: true, data: { subscriber: toSubscriberReceiptDto(row) } });
    } catch (error) {
      next(error);
    }
  };

  /** API opt-out (token in the body). */
  unsubscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.body as UnsubscribeDto;
      const found = await this.newsletter.unsubscribe(token);
      res.status(found ? 200 : 404).json({
        success: found,
        data: { unsubscribed: found },
        ...(found ? {} : { error: 'Unknown unsubscribe token' }),
      });
    } catch (error) {
      next(error);
    }
  };

  /** Email-link opt-out: renders a small HTML confirmation page. */
  unsubscribeLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const found = await this.newsletter.unsubscribe(req.params.token as string);
      res.status(found ? 200 : 404).type('html').send(unsubscribePage(found));
    } catch (error) {
      next(error);
    }
  };
}
