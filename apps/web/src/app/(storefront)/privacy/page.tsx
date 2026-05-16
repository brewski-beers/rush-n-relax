import { buildMetadata } from '@/lib/seo/metadata.factory';

export const metadata = buildMetadata('/privacy', {
  title: 'Privacy Policy — Rush N Relax',
  description:
    'How Rush N Relax collects, uses, shares, and protects your personal information.',
  path: '/privacy',
});

const EFFECTIVE = 'May 16, 2026';

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <h1>Privacy Policy</h1>
          <p className="lead">
            Effective {EFFECTIVE} · Last Updated {EFFECTIVE}
          </p>
        </div>
      </section>

      <section className="legal-content asymmetry-section-stable">
        <div className="container">
          <p>
            Rush N Relax (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;) respects your privacy. This Privacy Policy
            explains what information we collect, how we use and share it, and
            the choices you have when you use our website, online store, and
            retail locations (the &ldquo;Services&rdquo;).
          </p>

          <h2>1. Information We Collect</h2>
          <p>
            <strong>Information you provide:</strong>
          </p>
          <ul>
            <li>
              Contact details (name, email, phone, shipping/billing address)
              when you create an account, place an order, or contact us.
            </li>
            <li>
              Date of birth and government-ID information submitted to our
              age-verification provider at checkout.
            </li>
            <li>
              Payment information processed by our payment processor (we do not
              store full card numbers on our servers).
            </li>
            <li>
              Communications you send us (support requests, reviews, feedback).
            </li>
          </ul>
          <p>
            <strong>Information collected automatically:</strong>
          </p>
          <ul>
            <li>
              Device and browser information (IP address, device type, operating
              system, browser type).
            </li>
            <li>
              Usage data (pages viewed, links clicked, referring URLs,
              timestamps).
            </li>
            <li>Cookies and similar technologies (see Section 5).</li>
          </ul>
          <p>
            <strong>Information from third parties:</strong>
          </p>
          <ul>
            <li>Age-verification results from AgeChecker.net.</li>
            <li>
              Payment authorization and fraud-screening results from Clover.
            </li>
            <li>
              Analytics data from Google Analytics, Vercel Analytics, and
              similar providers.
            </li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>
              Process and fulfill orders, including age verification, payment,
              and shipping.
            </li>
            <li>Provide customer support and respond to inquiries.</li>
            <li>
              Send transactional messages (order confirmations, shipping
              updates, receipts).
            </li>
            <li>
              Send marketing communications by email or SMS where you have opted
              in. Email recipients may unsubscribe via the link in any marketing
              email. SMS recipients may reply <strong>STOP</strong> to cancel or{' '}
              <strong>HELP</strong> for help. Message and data rates may apply;
              consent is not a condition of purchase. We comply with the federal
              CAN-SPAM Act and the Telephone Consumer Protection Act (TCPA).
            </li>
            <li>Operate, maintain, and improve the Services.</li>
            <li>
              Detect, prevent, and respond to fraud, abuse, and security
              incidents.
            </li>
            <li>
              Comply with legal obligations and enforce our{' '}
              <a href="/terms">Terms &amp; Conditions</a>.
            </li>
          </ul>

          <h2>3. How We Share Your Information</h2>
          <p>
            We do not sell your personal information. We share information only
            as described below:
          </p>
          <ul>
            <li>
              <strong>Service providers</strong> who help us operate the
              Services, including hosting (Vercel), backend infrastructure
              (Google Firebase), payment processing (Clover), age verification
              (AgeChecker.net), shipping carriers, email/SMS providers, and
              analytics providers. These providers are contractually limited to
              using your information to perform services for us.
            </li>
            <li>
              <strong>Legal &amp; safety:</strong> when required by law,
              subpoena, or to protect the rights, property, or safety of Rush N
              Relax, our customers, or others.
            </li>
            <li>
              <strong>Business transfers:</strong> in connection with a merger,
              acquisition, financing, or sale of assets, your information may be
              transferred as part of that transaction.
            </li>
          </ul>

          <h2>4. Data Retention</h2>
          <p>
            We retain personal information for as long as needed to provide the
            Services, fulfill the purposes described in this Policy, comply with
            legal obligations, resolve disputes, and enforce our agreements.
            Order, tax, and age-verification records may be retained for the
            period required by applicable law.
          </p>

          <h2>5. Cookies &amp; Tracking Technologies</h2>
          <p>
            We and our service providers use cookies, pixels, web beacons, local
            storage, and similar technologies (collectively,
            &ldquo;Cookies&rdquo;) to operate the Services, remember your
            preferences, analyze traffic, measure marketing performance, and
            detect fraud.
          </p>
          <ul>
            <li>
              <strong>Strictly necessary</strong> cookies are required for the
              Services to function (e.g., session, cart, checkout).
            </li>
            <li>
              <strong>Analytics</strong> cookies help us understand how the
              Services are used (e.g., Google Analytics, Vercel Analytics).
            </li>
            <li>
              <strong>Marketing</strong> cookies may be used to measure ad
              performance and personalize content (e.g., Meta/Facebook Pixel,
              where deployed).
            </li>
          </ul>
          <p>
            You can control or disable Cookies through your browser settings;
            disabling Cookies may affect site functionality.
          </p>
          <p>
            <strong>Do Not Track.</strong> Some browsers transmit a &ldquo;Do
            Not Track&rdquo; (DNT) signal. Because no consistent industry
            standard for DNT exists, the Services do not currently respond to
            DNT signals.
          </p>

          <h2>6. SMS Platform Disclosure</h2>
          <p>
            If you opt in to SMS messages from Rush N Relax, your mobile number
            and message content are processed by our SMS provider for the
            purpose of delivering messages and managing opt-out requests. Your
            mobile information is{' '}
            <strong>
              not sold or shared with third parties for promotional or marketing
              purposes
            </strong>{' '}
            by Rush N Relax or our SMS provider. Reply <strong>STOP</strong> to
            cancel or <strong>HELP</strong> for help. Message and data rates may
            apply.
          </p>

          <h2>7. Your Rights &amp; Choices</h2>
          <p>Depending on where you live, you may have the right to:</p>
          <ul>
            <li>
              Access, correct, or delete personal information we hold about you.
            </li>
            <li>
              Opt out of marketing communications (use the unsubscribe link in
              any marketing email).
            </li>
            <li>Request a copy of your information in a portable format.</li>
            <li>
              Withdraw consent where we rely on consent to process your
              information.
            </li>
          </ul>
          <p>
            To exercise these rights, contact us at the address in Section 13.
            We will respond consistent with applicable law.
          </p>
          <p>
            <strong>State-Specific Rights.</strong> Residents of California
            (CCPA/CPRA), Colorado (CPA), Connecticut (CTDPA), Virginia (VCDPA),
            Utah (UCPA), and other states with comprehensive privacy laws may
            have additional rights, including the right to know, delete,
            correct, opt out of targeted advertising, opt out of
            &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of personal information,
            and appeal a denied request.{' '}
            <strong>We do not sell personal information.</strong> To submit a
            request or appeal, contact us at the address in Section 13.
          </p>

          <h2>8. Children&rsquo;s Privacy</h2>
          <p>
            The Services are intended for adults{' '}
            <strong>21 years of age or older</strong>. We do not knowingly
            collect information from anyone under 21 (or under 13 within the
            meaning of the federal Children&rsquo;s Online Privacy Protection
            Act). If we learn we have collected information from a person under
            21, we will delete it promptly.
          </p>

          <h2>9. Security &amp; Data-Breach Notification</h2>
          <p>
            We use reasonable administrative, technical, and physical safeguards
            designed to protect your information. However, no method of
            transmission or storage is 100% secure, and we cannot guarantee
            absolute security.
          </p>
          <p>
            In the event of a data breach involving your personal information,
            we will notify affected individuals and applicable regulators as
            required by Tennessee Code Annotated &sect; 47-18-2107 and any other
            applicable state or federal breach-notification laws.
          </p>

          <h2>10. Third-Party Links</h2>
          <p>
            The Services may contain links to third-party websites. We are not
            responsible for the privacy practices or content of those sites.
            Review their privacy policies before providing information.
          </p>

          <h2>11. International Users</h2>
          <p>
            The Services are operated from the United States and are intended
            for U.S. users. If you access the Services from outside the United
            States, you understand that your information will be transferred to,
            stored, and processed in the United States.
          </p>

          <h2>12. Changes to This Policy</h2>
          <p>
            We may update this Policy from time to time. The &ldquo;Last
            Updated&rdquo; date above reflects the most recent revision.
            Material changes will be communicated through the Services or by
            other reasonable means.
          </p>

          <h2>13. Contact Us</h2>
          <p>Questions about this Policy or your information? Contact us at:</p>
          <address>
            <strong>Rush N Relax</strong>
            <br />
            110 Bus Terminal Rd
            <br />
            Oak Ridge, TN 37830
            <br />
            Email: <a href="mailto:rush@rushnrelax.com">rush@rushnrelax.com</a>
            <br />
            Phone: <a href="tel:+18659363069">+1 (865) 936-3069</a>
          </address>
        </div>
      </section>
    </main>
  );
}
