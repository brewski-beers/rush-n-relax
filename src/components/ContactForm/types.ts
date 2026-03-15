export interface ContactState {
  type: 'idle' | 'success' | 'error';
  message: string;
  errors: { name?: string; email?: string; message?: string };
  emailDomain?: string;
}

export const INITIAL_CONTACT_STATE: ContactState = {
  type: 'idle',
  message: '',
  errors: {},
};
