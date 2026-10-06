/** Human-readable names for security-log actions. */
export const ACTION_LABEL = {
  login: 'Signed in', login_failed: 'Failed sign-in', login_locked: 'Sign-in while locked', password_changed: 'Changed password',
  portal_login: 'Patient portal sign-in', portal_login_failed: 'Failed portal sign-in', portal_record_viewed: 'Patient viewed own record',
  patient_record_viewed: 'Opened a case file', staff_added: 'Added clinic staff', staff_removed: 'Removed clinic staff', signup: 'Self sign-up',
  admin_create_doctor: 'Created doctor account', admin_update_doctor: 'Updated doctor account', admin_reset_password: 'Reset a password',
  admin_unlock: 'Unlocked an account', admin_create_clinic: 'Created a clinic',
};
