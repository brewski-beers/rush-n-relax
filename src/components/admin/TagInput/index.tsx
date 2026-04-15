'use client';

import { useState, useRef, useId } from 'react';

interface Props {
  /** FormData key — server action reads this field name */
  name: string;
  initialTags?: string[];
  placeholder?: string;
  /** Label shown above the input */
  label: string;
  hint?: string;
}

/**
 * Tag chip input — type a word and press Enter or comma to add it.
 * Submits as a single hidden input (comma-joined) so server actions
 * using formData.get(name) + .split(',') continue to work unchanged.
 */
export function TagInput({
  name,
  initialTags = [],
  placeholder = 'Add tag…',
  label,
  hint,
}: Props) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState('');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const value = raw.trim().replace(/,+$/, '');
    if (!value || tags.includes(value)) return;
    setTags(prev => [...prev, value]);
    setInput('');
  }

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    // Auto-add when user types a comma
    if (val.endsWith(',')) {
      addTag(val.slice(0, -1));
    } else {
      setInput(val);
    }
  }

  function handleBlur() {
    if (input.trim()) addTag(input);
  }

  return (
    <div className="tag-input-wrap">
      <label htmlFor={inputId}>
        {label}
        {hint && <span className="admin-hint">{hint}</span>}
      </label>

      {/* Hidden input carries the joined value for form submission */}
      <input type="hidden" name={name} value={tags.join(',')} />

      <div
        className="tag-input-field"
        role="group"
        aria-label={label}
        onClick={() => inputRef.current?.focus()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.focus();
        }}
      >
        {tags.map(tag => (
          <span key={tag} className="tag-chip">
            {tag}
            <button
              type="button"
              className="tag-chip-remove"
              onClick={e => {
                e.stopPropagation();
                removeTag(tag);
              }}
              aria-label={`Remove ${tag}`}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className="tag-input-inner"
          value={input}
          placeholder={tags.length === 0 ? placeholder : ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
