import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

export const adminListUsers = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to access the user directory.');
  }
  if (request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Administrator access is required.');
  }

  const users = [];
  let pageToken;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    users.push(...page.users.map((user) => ({
      uid: user.uid,
      displayName: user.displayName || '',
      email: user.email || '',
      disabled: user.disabled,
      role: user.customClaims?.role === 'admin' ? 'admin' : 'user',
      createdAt: user.metadata.creationTime,
      lastSignInAt: user.metadata.lastSignInTime || null,
    })));
    pageToken = page.pageToken;
  } while (pageToken);

  users.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
  return { users };
});
