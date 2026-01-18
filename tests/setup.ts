import "@testing-library/jest-dom";
import { vi, beforeAll, afterEach, afterAll } from "vitest";

// Suppress console output during tests for cleaner output
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
};

beforeAll(() => {
  // Suppress console.log and console.error during tests
  // These are often triggered by code under test (e.g., googleCalendar.ts logging)
  console.log = vi.fn();
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterAll(() => {
  // Restore console after all tests
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: vi.fn(),
});

// Mock Element.scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

window.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  root = null;
  rootMargin = "";
  thresholds = [];
}

window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
