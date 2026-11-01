import type { User } from 'firebase/auth';
// The one list of admins, shared with the Cloud Functions. It lives in functions/
// because only that folder is uploaded when functions deploy.
import ADMIN_EMAILS from '../../functions/src/admin-emails.json';

export const isAdmin = (user: User | null): boolean => {
  if (!user || !user.email) {
    return false;
  }
  return ADMIN_EMAILS.includes(user.email);
};
