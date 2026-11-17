import { beforeEach, describe, expect, it } from 'vitest';
import { clearCapturedMails, getCapturedMails } from '@/lib/mailer/mailer';
import { handleInviteAccepted, handleInviteCreated } from '@/modules/admin/admin.events';

beforeEach(() => {
  clearCapturedMails();
});

describe('admin invite mail handler', () => {
  it('emails the accept link, role and expiry to the invitee', async () => {
    await handleInviteCreated({
      actorName: 'Root Admin',
      adminId: 'admin-2',
      email: 'grace@megatech.org',
      roleName: 'EDITOR',
      inviteUrl: 'http://localhost:5173/admin/invite?token=raw-token',
      expiresInHours: 72,
    });

    const [mail] = getCapturedMails();
    expect(mail?.template).toBe('adminInviteMailTemp');
    expect(mail?.to).toBe('grace@megatech.org');
    expect(mail?.subject).toBe('You are invited to Megatech admin');
    expect(mail?.html).toContain('http://localhost:5173/admin/invite?token=raw-token');
    expect(mail?.html).toContain('EDITOR');
  });
});

describe('admin invite accepted mail handler', () => {
  it('sends the welcome template with the admin web url', async () => {
    await handleInviteAccepted({
      adminId: 'admin-2',
      email: 'grace@megatech.org',
      firstName: 'Grace',
    });

    const [mail] = getCapturedMails();
    expect(mail?.template).toBe('welcomeAdminMailTemp');
    expect(mail?.html).toContain('http://localhost:5173');
  });
});