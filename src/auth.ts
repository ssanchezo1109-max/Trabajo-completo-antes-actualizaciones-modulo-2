import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Required scopes for Google Drive, Docs and Gmail (for Yahoo verification)
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/documents');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/calendar');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const persistedToken = localStorage.getItem('cached_access_token');
    const timestampStr = localStorage.getItem('cached_access_token_timestamp');
    let isExpired = false;

    if (timestampStr) {
      const timestamp = parseInt(timestampStr, 10);
      // Google access tokens are valid for 1 hour (3600 seconds). We expire it at 50 minutes to be safe.
      if (Date.now() - timestamp > 50 * 60 * 1000) {
        isExpired = true;
      }
    } else if (persistedToken) {
      // If there's a token but no timestamp, treat as expired/invalid to be safe
      isExpired = true;
    }

    if (user && persistedToken && !isExpired) {
      cachedAccessToken = persistedToken;
      if (onAuthSuccess) onAuthSuccess(user, persistedToken);
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('cached_access_token');
      localStorage.removeItem('cached_access_token_timestamp');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn('Sign-in already in progress. Ignoring duplicate call.');
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('cached_access_token', cachedAccessToken);
    localStorage.setItem('cached_access_token_timestamp', Date.now().toString());
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error in auth.ts:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  const timestampStr = localStorage.getItem('cached_access_token_timestamp');
  if (timestampStr) {
    const timestamp = parseInt(timestampStr, 10);
    if (Date.now() - timestamp > 50 * 60 * 1000) {
      cachedAccessToken = null;
      localStorage.removeItem('cached_access_token');
      localStorage.removeItem('cached_access_token_timestamp');
      return null;
    }
  }

  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem('cached_access_token');
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem('cached_access_token');
};
