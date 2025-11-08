/**
 * Extension TypeScript pour Express Request
 * Ajoute les propriétés Passport.js
 */

declare global {
  namespace Express {
    interface User {
      id_utilisateur: number;
      email: string;
      nom?: string;
      prenom?: string;
      telephone?: string;
      societe?: string;
      id_role?: number;
      date_creation?: Date;
      [key: string]: any;
    }

    interface Request {
      user?: User;
      isAuthenticated(): boolean;
      logIn(user: User, done: (err: any) => void): void;
      logOut(done: (err: any) => void): void;
    }
  }
}

export {};
