import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add required Google Workspace scopes
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive.file");

let cachedAccessToken: string | null = localStorage.getItem("google_access_token");
let isSigningIn = false;

// Safe wrapper to listen for auth state and token changes
export const initAuth = (
  onSuccess: (user: User, token: string) => void,
  onFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        cachedAccessToken = localStorage.getItem("google_access_token");
      }
      if (cachedAccessToken) {
        onSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        onFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem("google_access_token");
      onFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Google Sheets & Drive access token.");
    }
    cachedAccessToken = credential.accessToken;
    localStorage.setItem("google_access_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken || localStorage.getItem("google_access_token");
};

export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
    cachedAccessToken = null;
    localStorage.removeItem("google_access_token");
  } catch (error) {
    console.error("Sign out error:", error);
    throw error;
  }
};

export const clearExpiredToken = () => {
  cachedAccessToken = null;
  localStorage.removeItem("google_access_token");
};
