interface HeroProps {
  onShopNow: () => void;
  onSignIn?: () => void;
}

export function Hero({ onShopNow, onSignIn }: HeroProps) {
  return (
    <section className="hero grain-soft">
      <h1>Rush N Relax</h1>
      <p className="tagline">Cannabis is more than a product—it's an experience.</p>
      <div className="cta-row">
        <button className="cta" onClick={onShopNow}>Shop Now</button>
        {onSignIn && (
          <button className="cta-secondary" onClick={onSignIn}>Sign in</button>
        )}
      </div>
    </section>
  );
}
