import { useContext } from 'react';
import AuthContext, { type User } from '../contexts/AuthContext';

export type { User };

export const useAuth = () => useContext(AuthContext);
