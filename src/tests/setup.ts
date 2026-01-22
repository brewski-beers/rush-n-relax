import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  interface Assertion<T = any> extends jest.Matchers<void, T>, TestingLibraryMatchers<T, void> {}
}

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
