import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [uid, role = 'admin'] = process.argv.slice(2);
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

if (!uid || !['admin', 'user'].includes(role)) {
  console.error('Usage: node scripts/set-admin-role.js <FIREBASE_AUTH_UID> [admin|user]');
  process.exit(1);
}
if (!projectId) {
  console.error('Set GCLOUD_PROJECT to the Firebase project ID before running this script.');
  process.exit(1);
}

initializeApp({ projectId });
const auth = getAuth();
const account = await auth.getUser(uid);
await auth.setCustomUserClaims(uid, { ...account.customClaims, role });
console.log(`Set ${account.email || uid} role to ${role}. Have the user sign out and back in to refresh the role token.`);
