# Firebase and Netlify

The browser client uses Firebase Authentication for email/password accounts,
password reset, sign-in state, and logout. It prefers local browser persistence
and falls back to session persistence when local storage is unavailable. The
Prisma app does not store passwords or password hashes in browser storage.

User profile, financial state, and consent documents are stored under
`users/{uid}` in Cloud Firestore. The rules in `firestore.rules` restrict access
to the authenticated user's UID. Firebase Storage is not configured because
the application has no user-uploaded files to persist.

## Firebase Console

1. Enable the Email/Password provider in Firebase Authentication.
2. Create the Cloud Firestore database and publish `firestore.rules`.
3. Add the production Netlify domain and any preview domains to the authorized
   domains in Firebase Authentication.
4. Configure these public Web App settings as Netlify build environment
   variables:
   `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`,
   `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, and
   `FIREBASE_APP_ID`.

The Web App configuration is public. Never put service-account keys or other
administrative credentials in frontend code or Netlify frontend variables.

## Build and migration scope

Netlify runs `npm run build:netlify` and publishes `dist`. The build requires
`FIREBASE_API_KEY`, `FIREBASE_MESSAGING_SENDER_ID`, and `FIREBASE_APP_ID`.

Existing browser financial data can be copied to the signed-in Firebase account
after the user confirms the migration. The original local records are not
deleted. SQLite accounts and states are not migrated automatically.

The static Netlify deployment does not run `server.js`. Routes that still
depend on `/api`, including email/PDF and administration endpoints, require a
separately deployed compatible backend (for example, Netlify Functions).
