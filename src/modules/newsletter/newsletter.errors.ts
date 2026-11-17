import { HttpError } from '@/lib/errors/http.error';

export class SubscriberNotFoundError extends HttpError {
  constructor() {
    super(404, 'Subscriber not found');
  }
}

export class CampaignNotFoundError extends HttpError {
  constructor() {
    super(404, 'Campaign not found');
  }
}
