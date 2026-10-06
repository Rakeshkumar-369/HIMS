/** Where each kind of account lands after signing in. */
export const homeFor = (user) => {
  if (user.must_change_password) return '/change-password';
  return user.role === 'admin' ? '/admin' : '/app/today';
};
