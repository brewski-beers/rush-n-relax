import { useState } from 'react';
import { getFirestore$, trackEvent } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import './ContactForm.css';

interface FormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

interface FormStatus {
  type: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}

export function ContactForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    message: '',
  });

  const [formStatus, setFormStatus] = useState<FormStatus>({
    type: 'idle',
    message: '',
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      setFormStatus({
        type: 'error',
        message: 'Please check the form for errors.',
      });
      return;
    }

    setFormStatus({
      type: 'loading',
      message: 'Sending your message...',
    });

    try {
      const db = getFirestore$();
      const contactSubmissionsRef = collection(db, 'contact-submissions');

      await addDoc(contactSubmissionsRef, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        message: formData.message,
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });

      // Track analytics event
      trackEvent('contact_form_submitted', {
        email_domain: formData.email.split('@')[1],
      });

      setFormStatus({
        type: 'success',
        message:
          'Thank you! Your message has been sent successfully. We will get back to you soon.',
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        message: '',
      });

      // Clear success message after 5 seconds
      setTimeout(() => {
        setFormStatus({ type: 'idle', message: '' });
      }, 5000);
    } catch (error) {
      console.error('Error submitting form:', error);
      trackEvent('contact_form_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setFormStatus({
        type: 'error',
        message:
          'There was an error sending your message. Please try again or contact us directly.',
      });
    }
  };

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      {formStatus.message && (
        <div
          className={`form-status form-status-${formStatus.type}`}
          role="alert"
          aria-live="polite"
        >
          {formStatus.message}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="name" className={errors.name ? 'required' : ''}>
          Name
        </label>
        <input
          id="name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Your name"
          required
          disabled={formStatus.type === 'loading'}
          className={errors.name ? 'error' : ''}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <span id="name-error" className="error-message">
            {errors.name}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="email" className={errors.email ? 'required' : ''}>
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="your@email.com"
          required
          inputMode="email"
          disabled={formStatus.type === 'loading'}
          className={errors.email ? 'error' : ''}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <span id="email-error" className="error-message">
            {errors.email}
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
          value={formData.phone}
          onChange={handleChange}
          placeholder="(555) 123-4567"
          inputMode="tel"
          disabled={formStatus.type === 'loading'}
        />
      </div>

      <div className="form-group">
        <label htmlFor="message" className={errors.message ? 'required' : ''}>
          Message
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder="Tell us how we can help..."
          required
          disabled={formStatus.type === 'loading'}
          className={errors.message ? 'error' : ''}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? 'message-error' : undefined}
          rows={5}
        />
        {errors.message && (
          <span id="message-error" className="error-message">
            {errors.message}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={formStatus.type === 'loading'}
        className="form-submit"
        aria-busy={formStatus.type === 'loading'}
      >
        {formStatus.type === 'loading' ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
