const { supabaseAdmin } = require('@src/supabaseClient');
const { consumeLimiter } = require('@utils/rateLimit');

const INVITE_REDIRECT_URL = 'http://localhost:5173/set-password';

async function sendInviteEmail(email, actorUserId) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  await consumeLimiter(
    'supabaseInviteTarget',
    { keyPrefix: 'provider:supabase_invite:target', points: 1, duration: 900 },
    normalizedEmail,
    {
      code: 'RATE_LIMITED_INVITE_TARGET',
      message: 'An invite was already sent recently to this email address. Please try again later.',
    }
  );

  await consumeLimiter(
    'supabaseInviteActor',
    { keyPrefix: 'provider:supabase_invite:actor', points: 10, duration: 3600 },
    actorUserId || 'unknown-actor',
    {
      code: 'RATE_LIMITED_INVITE_ACTOR',
      message: 'Too many invite emails were sent from this account. Please try again later.',
    }
  );

  await consumeLimiter(
    'supabaseInviteGlobal',
    { keyPrefix: 'provider:supabase_invite:global', points: 30, duration: 3600 },
    'global',
    {
      code: 'RATE_LIMITED_INVITE_GLOBAL',
      message: 'Invite email sending is temporarily busy. Please try again later.',
    }
  );

  return supabaseAdmin.auth.admin.inviteUserByEmail(
    normalizedEmail,
    {
      redirectTo: INVITE_REDIRECT_URL,
      data: {
        must_change_password: true,
      },
    }
  );
}

module.exports = {
  sendInviteEmail,
};
