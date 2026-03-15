'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { trackEvent } from '../../firebase';
import { submitContact } from './actions';
import { INITIAL_CONTACT_STATE, type ContactState } from './types';
import './ContactForm.css';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="form-submit"
      aria-busy={pending}
    >
      {pending ? 'Sending...' : 'Send Message'}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState(
    submitContact,
    INITIAL_CONTACT_STATE
  );
  const formRef = useRef<HTMLFormElement>(null);
  const prevType = useRef<ContactState['type']>('idle');

  useEffect(() => {
    if (state.type === prevType.current) return;
    prevType.current = state.type;

    if (state.type === 'success') {
      formRef.current?.reset();
      trackEvent('contact_form_submitted', { email_domain: state.emailDomain });
    } else if (
      state.type === 'error' &&
      Object.keys(state.errors).length === 0
    ) {
      trackEvent('contact_form_error', { error: state.message });
    }
  }, [state]);

  return (
    <form ref={formRef} className="contact-form" action={formAction} noValidate>
      {state.message && (
        <div
          className={`form-status form-status-${state.type}`}
          role="alert"
          aria-live="polite"
        >
          {state.message}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="name" className={state.errors.name ? 'required' : ''}>
          Name
        </label>
        <input
          id="name"
          type="text"
          name="name"
          placeholder="Your name"
          required
          className={state.errors.name ? 'error' : ''}
          aria-invalid={!!state.errors.name}
          aria-describedby={state.errors.name ? 'name-error' : undefined}
        />
        {state.errors.name && (
          <span id="name-error" className="error-message">
            {state.errors.name}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="email" className={state.errors.email ? 'required' : ''}>
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          placeholder="your@email.com"
          required
          inputMode="email"
          className={state.errors.email ? 'error' : ''}
          aria-invalid={!!state.errors.email}
          aria-describedby={state.errors.email ? 'email-error' : undefined}
        />
        {state.errors.email && (
          <span id="email-error" className="error-message">
            {state.errors.email}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="phone">
          Phone <span className="optional">(optional)</span>
        </label>
        <input
          id="phone"
          type="tel"
          name="phone"
          placeholder="(555) 123-4567"
          inputMode="tel"
        />
      </div>

      <div className="form-group">
        <label
          htmlFor="message"
          className={state.errors.message ? 'required' : ''}
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          placeholder="Tell us how we can help..."
          required
          className={state.errors.message ? 'error' : ''}
          aria-invalid={!!state.errors.message}
          aria-describedby={state.errors.message ? 'message-error' : undefined}
          rows={5}
        />
        {state.errors.message && (
          <span id="message-error" className="error-message">
            {state.errors.message}
          </span>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
