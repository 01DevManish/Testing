/**
 * Dynamo-only runtime shim.
 * Keeps legacy imports stable while Firebase SDK is removed from the app flow.
 */

export const firebaseConfig = {};
export const auth = {} as any;
export const googleProvider = {} as any;
export const db = {} as any;
export const storage = {} as any;

export const messaging = async () => null;

const app = {} as any;
export default app;
