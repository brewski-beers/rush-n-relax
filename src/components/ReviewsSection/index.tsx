import { Card } from '../Card';
import type { GoogleReview } from '../../types/reviews';
import './ReviewsSection.css';

interface ReviewsSectionProps {
  rating: number | null;
  totalRatings: number | null;
  reviews: GoogleReview[];
  status: 'idle' | 'loading' | 'success' | 'error';
  locationName: string;
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <span
      className="reviews-stars"
      aria-label={`${rating} out of 5 stars`}
      role="img"
    >
      {'★'.repeat(full)}
      {hasHalf ? '½' : ''}
      {'☆'.repeat(empty)}
    </span>
  );
}

export function ReviewsSection({
  rating,
  totalRatings,
  reviews,
  status,
  locationName,
}: ReviewsSectionProps) {
  if (status === 'idle' || status === 'error') return null;

  return (
    <section
      className="location-reviews-section"
      aria-labelledby="reviews-heading"
    >
      <div className="container">
        <h2 id="reviews-heading">What Customers Are Saying</h2>

        {status === 'loading' && (
          <div className="reviews-loading" aria-live="polite" aria-busy="true">
            <div className="reviews-spinner" aria-hidden="true" />
            <p>Loading reviews...</p>
          </div>
        )}

        {status === 'success' && rating !== null && (
          <>
            <div className="reviews-summary">
              <span className="reviews-rating-number">{rating.toFixed(1)}</span>
              <StarRating rating={rating} />
              {totalRatings !== null && (
                <span className="reviews-count">
                  Based on {totalRatings.toLocaleString()} Google{' '}
                  {totalRatings === 1 ? 'review' : 'reviews'}
                </span>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${locationName} Rush N Relax`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="reviews-google-link"
                aria-label={`Read all reviews for ${locationName} on Google`}
              >
                Read all reviews on Google →
              </a>
            </div>

            {reviews.length > 0 && (
              <div className="reviews-grid" role="list">
                {reviews.map((review, i) => (
                  <Card
                    key={`${review.author_name}-${i}`}
                    variant="info"
                    as="article"
                  >
                    <div className="review-header">
                      <span className="review-author">
                        {review.author_name}
                      </span>
                      <StarRating rating={review.rating} />
                    </div>
                    <p className="review-text">{review.text}</p>
                    <p className="review-time text-secondary">
                      {review.relative_time_description}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default ReviewsSection;
