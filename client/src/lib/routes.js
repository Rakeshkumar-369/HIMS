/** Where each kind of account lands after signing in. */
export const homeFor = (user) => {
  if (user.must_change_password) return '/change-password';
  if (user.role === 'admin') return '/admin';
  // a doctor who only works as a visiting/freelance doctor starts on the work log
  return user.role === 'doctor' && user.practice_type === 'freelance' ? '/app/work' : '/app/today';
};
