import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewsSection } from './index';
import type { GoogleReview } from '../../types/reviews';

const mockReviews: GoogleReview[] = [
  {
    author_name: 'Alice Smith',
    rating: 5,
    text: 'Amazing dispensary! Staff was incredibly knowledgeable and helpful.',
    relative_time_description: '2 weeks ago',
    profile_photo_url: '',
    time: 1700000000,
  },
  {
    author_name: 'Bob Johnson',
    rating: 4,
    text: 'Great selection and friendly staff. Will definitely come back.',
    relative_time_description: '1 month ago',
    profile_photo_url: '',
    time: 1698000000,
  },
];

describe('ReviewsSection', () => {
  describe('when status is idle', () => {
    it('renders nothing', () => {
      const { container } = render(
        <ReviewsSection
          rating={null}
          totalRatings={null}
          reviews={[]}
          status="idle"
          locationName="Oak Ridge"
        />
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('when status is error', () => {
    it('renders nothing (fail silently)', () => {
      const { container } = render(
        <ReviewsSection
          rating={null}
          totalRatings={null}
          reviews={[]}
          status="error"
          locationName="Oak Ridge"
        />
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('when status is loading', () => {
    it('renders the section with a loading indicator', () => {
      render(
        <ReviewsSection
          rating={null}
          totalRatings={null}
          reviews={[]}
          status="loading"
          locationName="Oak Ridge"
        />
      );
      expect(screen.getByText('What Customers Are Saying')).toBeInTheDocument();
      expect(screen.getByText('Loading reviews...')).toBeInTheDocument();
    });

    it('does not render rating or review cards while loading', () => {
      render(
        <ReviewsSection
          rating={null}
          totalRatings={null}
          reviews={[]}
          status="loading"
          locationName="Oak Ridge"
        />
      );
      expect(screen.queryByText(/Based on.*Google/)).not.toBeInTheDocument();
    });
  });

  describe('when status is success', () => {
    it('renders the rating score and formatted count', () => {
      render(
        <ReviewsSection
          rating={4.7}
          totalRatings={142}
          reviews={mockReviews}
          status="success"
          locationName="Oak Ridge"
        />
      );
      expect(screen.getByText('4.7')).toBeInTheDocument();
      expect(
        screen.getByText('Based on 142 Google reviews')
      ).toBeInTheDocument();
    });

    it('uses singular "review" when totalRatings is 1', () => {
      render(
        <ReviewsSection
          rating={5.0}
          totalRatings={1}
          reviews={mockReviews}
          status="success"
          locationName="Oak Ridge"
        />
      );
      expect(screen.getByText('Based on 1 Google review')).toBeInTheDocument();
    });

    it('renders a Google link with correct aria-label', () => {
      render(
        <ReviewsSection
          rating={4.7}
          totalRatings={142}
          reviews={mockReviews}
          status="success"
          locationName="Oak Ridge"
        />
      );
      const link = screen.getByRole('link', {
        name: /read all reviews for oak ridge on google/i,
      });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders all provided review cards', () => {
      render(
        <ReviewsSection
          rating={4.7}
          totalRatings={142}
          reviews={mockReviews}
          status="success"
          locationName="Oak Ridge"
        />
      );
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Amazing dispensary! Staff was incredibly knowledgeable and helpful.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('2 weeks ago')).toBeInTheDocument();
      expect(screen.getByText('1 month ago')).toBeInTheDocument();
    });

    it('renders the section heading', () => {
      render(
        <ReviewsSection
          rating={4.7}
          totalRatings={142}
          reviews={mockReviews}
          status="success"
          locationName="Oak Ridge"
        />
      );
      expect(
        screen.getByRole('heading', { name: 'What Customers Are Saying' })
      ).toBeInTheDocument();
    });

    it('renders no review cards when reviews array is empty', () => {
      render(
        <ReviewsSection
          rating={4.2}
          totalRatings={30}
          reviews={[]}
          status="success"
          locationName="Seymour"
        />
      );
      // Rating summary still shows
      expect(screen.getByText('4.2')).toBeInTheDocument();
      // But no review list
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('star rating has accessible aria-label', () => {
      render(
        <ReviewsSection
          rating={4.7}
          totalRatings={142}
          reviews={[]}
          status="success"
          locationName="Oak Ridge"
        />
      );
      // The summary star rating
      const starRatings = screen.getAllByRole('img', {
        name: /out of 5 stars/i,
      });
      expect(starRatings.length).toBeGreaterThan(0);
    });
  });
});
