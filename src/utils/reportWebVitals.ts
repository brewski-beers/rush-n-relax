import { useEffect } from 'react';
import { onCLS, onINP, onFCP, onLCP, onTTFB, Metric } from 'web-vitals';

/**
 * Report Web Vitals to Analytics
 * 
 * Sends Core Web Vitals metrics to analytics service.
 * Can be integrated with Google Analytics, Firebase, or custom endpoints.
 */
export function reportWebVitals(onPerfEntry?: (metric: Metric) => void) {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    onCLS(onPerfEntry);
    onINP(onPerfEntry); // Replaced FID in web-vitals v3
    onFCP(onPerfEntry);
    onLCP(onPerfEntry);
    onTTFB(onPerfEntry);
  }
}

/**
 * Log Web Vitals to Console (Development)
 */
export function logWebVitals(metric: Metric) {
  const { name, value, rating } = metric;
  
  // Color-code based on rating
  const style = rating === 'good' ? 'color: green' : rating === 'needs-improvement' ? 'color: orange' : 'color: red';
  
  console.log(`%c[Web Vitals] ${name}: ${value.toFixed(2)}ms (${rating})`, style);
}

/**
 * Send Web Vitals to Firebase Analytics
 */
export function sendToFirebase(metric: Metric) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    });
  }
}

/**
 * useWebVitals Hook
 * 
 * React hook to initialize Web Vitals reporting.
 */
export function useWebVitals() {
  useEffect(() => {
    // In development, log to console
    if (import.meta.env.DEV) {
      reportWebVitals(logWebVitals);
    } else {
      // In production, send to Firebase
      reportWebVitals(sendToFirebase);
    }
  }, []);
}
