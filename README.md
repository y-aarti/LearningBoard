# Dayboard

React + Vite learning goals board using Firebase Authentication and Cloud Firestore.

## Firebase setup

1. Create a Firebase project and add a **Web app** in the Firebase console.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. Create a Cloud Firestore database.
4. Copy `.env.example` to `.env.local` and fill in the Web app config values from **Project settings → Your apps**.
5. Publish the rules in `firestore.rules` from **Firestore Database → Rules**. Each signed-in user can only read and write their own tasks, projects, and goals, including their one-time personalized learning plan.
6. Run `npm install` and `npm run dev`.

After sign-in, users land directly on the Goals page. Legacy browser-only tasks are imported when available; otherwise, the learning board starts empty.

Never put a Firebase Admin SDK key or service account secret in this frontend. The Firebase Web API config is designed for client apps; Firestore rules enforce per-user access.

## Admin user directory

Roles are Firebase Authentication custom claims. Accounts without a claim are treated as `user`. Only an account with the server-set claim `{ "role": "admin" }` sees **Admin** in the sidebar. The directory calls the `adminListUsers` Cloud Function; the function checks the claim before using the Firebase Admin SDK to list accounts. The browser cannot grant itself admin access.

To deploy the function, select the Firebase project and deploy from the project root:

```sh
npm --prefix functions install
firebase use <your-firebase-project-id>
firebase deploy --only functions
```

To grant or revoke admin access, use a trusted environment with Firebase Admin SDK Application Default Credentials and permission to manage Firebase Authentication users:

```sh
cd functions
GCLOUD_PROJECT=<your-firebase-project-id> node scripts/set-admin-role.js <firebase-auth-uid> admin
GCLOUD_PROJECT=<your-firebase-project-id> node scripts/set-admin-role.js <firebase-auth-uid> user
```

The user should sign out and sign in again after a role change so Firebase refreshes the ID token custom claim. Do not add a client-side role selector or expose an Admin SDK credential in the web app.
