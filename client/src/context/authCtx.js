import { createContext, useContext } from 'react';

export const AuthCtx = createContext(null);

/** Signed-in user, their clinics and the active clinic. */
export const useAuth = () => useContext(AuthCtx);
