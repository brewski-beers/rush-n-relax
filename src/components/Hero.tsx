interface HeroProps {
  onShopNow: () => void;
}

export function Hero({ onShopNow }: HeroProps) {
  return (
    <section className="hero">
      <h1>Rush N Relax</h1>
      <p className="tagline">Cannabis is more than a product—it's an experience.</p>
      <button className="cta" onClick={onShopNow}>Shop Now</button>
    </section>
  );
}
