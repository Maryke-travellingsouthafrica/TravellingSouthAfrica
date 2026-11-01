'use client';

import { useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Translatable } from '@/components/translatable';
import { cn } from '@/lib/utils';
import {
  countReviewChars,
  getCurrentSaMonth,
  REVIEW_LIMITS,
  validateReview,
  type ReviewContent,
} from '@/lib/reviews';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive">
      <Translatable text={message} />
    </p>
  );
}

/** Write or edit a review. `onSubmit` saves and reports failures; the form only validates. */
export function ReviewForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ReviewContent;
  submitLabel: string;
  onSubmit: (content: ReviewContent) => Promise<void>;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [visitDate, setVisitDate] = useState(initial?.visitDate ?? '');
  const [touched, setTouched] = useState<Partial<Record<keyof ReviewContent, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const content: ReviewContent = { rating, title, body, ...(visitDate ? { visitDate } : {}) };
  const errors = validateReview(content);
  const errorFor = (field: keyof ReviewContent) => (submitted || touched[field] ? errors[field] : undefined);
  const touch = (field: keyof ReviewContent) => () => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      await onSubmit(content);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <fieldset aria-describedby={errorFor('rating') ? 'review-rating-error' : undefined}>
        <legend className="text-sm font-medium mb-1">
          <Translatable text="Your rating *" />
        </legend>
        <div className="flex w-fit" onMouseLeave={() => setHoverRating(0)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <label key={star} className="cursor-pointer p-1.5" onMouseEnter={() => setHoverRating(star)}>
              <input
                type="radio"
                name="review-rating"
                value={star}
                checked={rating === star}
                onChange={() => setRating(star)}
                onBlur={touch('rating')}
                className="peer sr-only"
              />
              <Star
                aria-hidden="true"
                className={cn(
                  'h-8 w-8 rounded-sm text-yellow-400 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                  star <= (hoverRating || rating) && 'fill-yellow-400'
                )}
              />
              <span className="sr-only">
                <Translatable text={star === 1 ? '1 star' : `${star} stars`} />
              </span>
            </label>
          ))}
        </div>
        <FieldError id="review-rating-error" message={errorFor('rating')} />
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="review-title">
          <Translatable text="Title *" />
        </Label>
        <Input
          id="review-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={touch('title')}
          aria-invalid={!!errorFor('title')}
          aria-describedby="review-title-count review-title-error"
        />
        <div className="flex items-start justify-between gap-4">
          <FieldError id="review-title-error" message={errorFor('title')} />
          <p id="review-title-count" className="ml-auto shrink-0 text-xs text-muted-foreground">
            {countReviewChars(title)}/{REVIEW_LIMITS.titleMax}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-body">
          <Translatable text="Your review *" />
        </Label>
        <Textarea
          id="review-body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={touch('body')}
          aria-invalid={!!errorFor('body')}
          aria-describedby="review-body-count review-body-error"
        />
        <div className="flex items-start justify-between gap-4">
          <FieldError id="review-body-error" message={errorFor('body')} />
          <p id="review-body-count" className="ml-auto shrink-0 text-xs text-muted-foreground">
            {countReviewChars(body)}/{REVIEW_LIMITS.bodyMax}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-visit-date">
          <Translatable text="When did you visit? (optional)" />
        </Label>
        <Input
          id="review-visit-date"
          type="month"
          placeholder="2026-03"
          max={getCurrentSaMonth()}
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
          onBlur={touch('visitDate')}
          aria-invalid={!!errorFor('visitDate')}
          aria-describedby="review-visit-date-error"
          className="sm:w-56"
        />
        <FieldError id="review-visit-date-error" message={errorFor('visitDate')} />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          <Translatable text="Cancel" />
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Translatable text={submitLabel} />
        </Button>
      </div>
    </form>
  );
}
