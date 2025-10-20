export interface AuthSession {
  userId?: string;
  email?: string;
  name?: string;
}

export interface AuthProvider {
  getCurrentUser(req?: any): Promise<AuthSession | null>;
}


