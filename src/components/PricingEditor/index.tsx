import { useState } from 'react';

interface PricingEditorProps {
  productId: string;
  name: string;
  currentDisplayPrice: number;
  currentCost: number;
  currentMarkup: number;
  onSave?: (displayPrice: number, cost: number) => Promise<void>;
}

/**
 * PricingEditor - Focused pricing & markup configuration
 * Allows admins to adjust display price and cost
 * Shows margin calculation in real-time
 */
export function PricingEditor({
  productId,
  name,
  currentDisplayPrice,
  currentCost,
  currentMarkup,
  onSave,
}: PricingEditorProps) {
  const [displayPrice, setDisplayPrice] = useState(currentDisplayPrice);
  const [cost, setCost] = useState(currentCost);
  const [isSaving, setIsSaving] = useState(false);

  const calculateMarkup = (price: number, cost: number) => {
    if (cost === 0) return 0;
    return ((price - cost) / cost) * 100;
  };

  const calculatedMarkup = calculateMarkup(displayPrice, cost);
  const profit = displayPrice - cost;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (onSave) {
        await onSave(displayPrice, cost);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pricing-editor">
      <div className="pricing-header">
        <h3>{name}</h3>
        <p className="product-id">(ID: {productId})</p>
      </div>

      <div className="pricing-grid">
        {/* Cost Input */}
        <div className="pricing-field">
          <label htmlFor="cost">Cost</label>
          <div className="input-group">
            <span className="currency">$</span>
            <input
              id="cost"
              type="number"
              value={cost}
              onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
              className="input-price"
            />
          </div>
          <small className="help-text">Internal cost before markup</small>
        </div>

        {/* Display Price Input */}
        <div className="pricing-field">
          <label htmlFor="displayPrice">Display Price</label>
          <div className="input-group">
            <span className="currency">$</span>
            <input
              id="displayPrice"
              type="number"
              value={displayPrice}
              onChange={(e) => setDisplayPrice(parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
              className="input-price"
            />
          </div>
          <small className="help-text">Customer-facing price</small>
        </div>

        {/* Markup Display */}
        <div className="pricing-metric">
          <div className="metric-label">Markup</div>
          <div className="metric-value">
            {calculatedMarkup.toFixed(2)}%
          </div>
          <small className="help-text">
            Change: {(calculatedMarkup - currentMarkup).toFixed(2)}%
          </small>
        </div>

        {/* Profit Display */}
        <div className="pricing-metric">
          <div className="metric-label">Per-Unit Profit</div>
          <div className="metric-value">
            ${profit.toFixed(2)}
          </div>
          <small className="help-text">
            Change: ${(profit - (currentDisplayPrice - currentCost)).toFixed(2)}
          </small>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="pricing-presets">
        <p className="presets-label">Quick Markup Presets:</p>
        <button
          type="button"
          className="preset-btn"
          onClick={() => {
            const newPrice = cost * 1.3; // 30% markup
            setDisplayPrice(Math.round(newPrice * 100) / 100);
          }}
        >
          30%
        </button>
        <button
          type="button"
          className="preset-btn"
          onClick={() => {
            const newPrice = cost * 1.5; // 50% markup
            setDisplayPrice(Math.round(newPrice * 100) / 100);
          }}
        >
          50%
        </button>
        <button
          type="button"
          className="preset-btn"
          onClick={() => {
            const newPrice = cost * 2; // 100% markup
            setDisplayPrice(Math.round(newPrice * 100) / 100);
          }}
        >
          100%
        </button>
        <button
          type="button"
          className="preset-btn"
          onClick={() => {
            const newPrice = cost * 2.5; // 150% markup
            setDisplayPrice(Math.round(newPrice * 100) / 100);
          }}
        >
          150%
        </button>
      </div>

      {/* Comparison */}
      <div className="pricing-comparison">
        <div className="comparison-row">
          <span>Previous Markup</span>
          <strong>{currentMarkup.toFixed(2)}%</strong>
        </div>
        <div className="comparison-row">
          <span>New Markup</span>
          <strong className="highlight">
            {calculatedMarkup.toFixed(2)}%
          </strong>
        </div>
        <div className="comparison-divider" />
        <div className="comparison-row">
          <span>Previous Margin</span>
          <strong>${(currentDisplayPrice - currentCost).toFixed(2)}</strong>
        </div>
        <div className="comparison-row">
          <span>New Margin</span>
          <strong className="highlight">${profit.toFixed(2)}</strong>
        </div>
      </div>

      {/* Save Button */}
      <button
        type="button"
        className="btn btn-primary btn-lg"
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? 'Saving...' : 'Save Pricing'}
      </button>
    </div>
  );
}
