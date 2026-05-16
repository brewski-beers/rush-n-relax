import { buildMetadata } from '@/lib/seo/metadata.factory';

export const metadata = buildMetadata('/terms', {
  title: 'Terms & Conditions — Rush N Relax',
  description:
    'Terms and conditions governing your use of the Rush N Relax website and purchase of hemp and CBD products.',
  path: '/terms',
});

const EFFECTIVE = 'May 16, 2026';

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <h1>Terms &amp; Conditions</h1>
          <p className="lead">
            Effective {EFFECTIVE} · Last Updated {EFFECTIVE}
          </p>
        </div>
      </section>

      <section className="legal-content asymmetry-section-stable">
        <div className="container">
          <p>
            Welcome to Rush N Relax. These Terms &amp; Conditions
            (&ldquo;Terms&rdquo;) govern your access to and use of the Rush N
            Relax website, online store, and retail locations (collectively, the
            &ldquo;Services&rdquo;) operated by Rush N Relax (&ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By accessing the Services
            or making a purchase, you agree to be bound by these Terms. If you
            do not agree, do not use the Services.
          </p>
          <p>
            <strong>
              PLEASE READ THESE TERMS CAREFULLY. THEY INCLUDE AN ASSUMPTION OF
              RISK (SECTION 5), A BINDING INDIVIDUAL ARBITRATION PROVISION AND
              CLASS-ACTION WAIVER (SECTION 14), AND A JURY-TRIAL WAIVER, ALL OF
              WHICH AFFECT YOUR LEGAL RIGHTS.
            </strong>
          </p>

          <h2>1. Electronic Acceptance</h2>
          <p>
            By creating an account, checking an &ldquo;I agree&rdquo; box at
            checkout, completing a purchase, or otherwise using the Services,
            you electronically agree to be bound by these Terms, our{' '}
            <a href="/privacy">Privacy Policy</a>, and our{' '}
            <a href="/shipping">Shipping &amp; Returns Policy</a>. Your
            electronic acceptance has the same legal effect as a handwritten
            signature under the federal E-SIGN Act and Tennessee&rsquo;s Uniform
            Electronic Transactions Act.
          </p>

          <h2>2. Eligibility &amp; Age Verification</h2>
          <p>
            You must be <strong>at least 21 years of age</strong> to access,
            browse, or purchase from this site. By using the Services, you
            represent and warrant that you are of legal age and have the legal
            capacity to enter into a binding agreement. We use third-party
            age-verification services (including AgeChecker.net) at checkout. We
            reserve the right to refuse service, cancel orders, or terminate
            accounts where age cannot be verified.
          </p>

          <h2>3. Products &amp; Hemp Compliance</h2>
          <p>
            Rush N Relax sells hemp-derived products, accessories, and related
            goods. All products sold on this site are intended for use by adults
            21 years of age or older.
          </p>
          <p>
            <strong>
              All products are derived from federally lawful hemp and contain no
              more than 0.3% delta-9 THC on a dry-weight basis, consistent with
              the 2018 Agricultural Improvement Act (&ldquo;Farm Bill&rdquo;)
              and applicable Tennessee law, unless otherwise expressly
              permitted.
            </strong>{' '}
            Products are not intended to diagnose, treat, cure, or prevent any
            disease. These statements have not been evaluated by the U.S. Food
            and Drug Administration.
          </p>
          <p>
            <strong>
              Laws governing hemp, THCa, and hemp-derived cannabinoids are
              rapidly evolving at the federal, state, and local level and may
              change without notice.
            </strong>{' '}
            You are solely responsible for understanding and complying with the
            laws of your jurisdiction before placing an order.{' '}
            <strong>
              We make no representation or warranty regarding the legality of
              our products in any state, county, or municipality outside our
              shipping footprint.
            </strong>{' '}
            We do not ship to states or localities where the products are
            prohibited or restricted.
          </p>
          <p>
            <strong>
              Products may not be purchased on behalf of, gifted to, resold to,
              or otherwise transferred to any individual under 21 years of age.
            </strong>{' '}
            Doing so is a violation of these Terms and may violate state or
            federal law.
          </p>

          <h3>Product Warnings</h3>
          <p>
            Hemp-derived products, including THCa flower, edibles, vapes,
            beverages, and concentrates, may produce intoxicating effects. By
            purchasing, you acknowledge and agree to the following warnings:
          </p>
          <ul>
            <li>
              <strong>Keep out of reach of children and pets.</strong>
            </li>
            <li>
              <strong>
                Do not drive, operate heavy machinery, or perform tasks
                requiring full alertness after use.
              </strong>
            </li>
            <li>
              <strong>
                Consult a physician before use, especially if you are pregnant,
                nursing, taking medication, or have a medical condition.
              </strong>
            </li>
            <li>
              <strong>
                May cause intoxicating effects; use responsibly and start with a
                low dose.
              </strong>
            </li>
            <li>
              <strong>
                Rush N Relax makes no guarantee that any product will not
                trigger a positive drug-test result.
              </strong>{' '}
              Do not use if you are subject to drug testing.
            </li>
          </ul>

          <h3>Lab Testing &amp; Certificates of Analysis</h3>
          <p>
            Our hemp products are tested by independent third-party laboratories
            for cannabinoid content and contaminants in accordance with
            applicable law. Certificates of Analysis (COAs) are available upon
            request and may be linked on individual product pages.
          </p>

          <h3>No Medical Advice</h3>
          <p>
            All content on the Services &mdash; including product descriptions,
            blog posts, education pages, and customer-support communications
            &mdash; is provided{' '}
            <strong>
              for informational purposes only and does not constitute medical,
              legal, or professional advice.
            </strong>{' '}
            Always consult a qualified healthcare provider regarding any medical
            condition or before using any hemp-derived product.
          </p>

          <h3>Website Accuracy</h3>
          <p>
            We strive to keep product descriptions, potency information, images,
            pricing, inventory, and other website content accurate, but{' '}
            <strong>
              we do not warrant that any such content is accurate, complete,
              current, or error-free.
            </strong>{' '}
            We reserve the right to correct errors, update content, and cancel
            or refuse orders affected by pricing, potency, or inventory
            mistakes, even after an order has been submitted.
          </p>

          <h2>4. Orders, Pricing &amp; Payment</h2>
          <p>
            All orders are subject to acceptance and product availability. We
            reserve the right to refuse or cancel any order at our discretion,
            including for suspected fraud, age-verification failure, inventory
            error, or pricing error.
          </p>
          <ul>
            <li>
              Prices are listed in U.S. dollars and are subject to change
              without notice.
            </li>
            <li>
              Applicable taxes and shipping fees are calculated at checkout.
            </li>
            <li>
              Payment is processed through Clover, our third-party payment
              processor. We do not store full payment-card numbers on our
              servers.
            </li>
            <li>
              An order is not confirmed until payment is successfully captured
              and you receive an order confirmation.
            </li>
          </ul>

          <h3>Right to Refuse Service</h3>
          <p>
            We reserve the right, in our sole discretion and without prior
            notice, to refuse any sale, cancel any order, limit purchase
            quantities, restrict access from specific geographic regions, and
            refuse or terminate service to any person we reasonably believe to
            be: a reseller without authorization, a minor, intoxicated, engaged
            in fraud, in violation of these Terms, or in violation of any
            applicable law.
          </p>

          <h3>Chargebacks &amp; Fraud</h3>
          <p>
            Fraudulent or unauthorized chargebacks will be disputed. We may
            submit supporting documentation including, but not limited to,
            age-verification records, IP and device logs, order confirmations,
            shipping and tracking records, delivery confirmation, signature
            records, and identity-verification data to the cardholder&rsquo;s
            bank and to law enforcement where appropriate. Customers who
            initiate fraudulent chargebacks may be banned from future purchases
            and may be referred for civil or criminal action.
          </p>

          <h2>5. Assumption of Risk</h2>
          <p>
            By purchasing, receiving, or using any hemp-derived product from
            Rush N Relax, you{' '}
            <strong>voluntarily and knowingly assume all risks</strong>{' '}
            associated with possession, use, and consumption, including but not
            limited to: intoxication; impairment of judgment, coordination, or
            reflexes; allergic reaction; adverse health effects; interaction
            with medications or pre-existing conditions; positive drug-test
            results; and any legal, employment, custodial, or insurance
            consequences that may follow.
          </p>
          <p>
            You acknowledge that effects vary by individual, that dosage
            response is unpredictable, that products may impair judgment, and
            that{' '}
            <strong>
              you alone are responsible for safe, lawful, and responsible use.
            </strong>{' '}
            This assumption of risk is a material part of the consideration for
            your purchase.
          </p>

          <h2>6. Shipping &amp; Returns</h2>
          <p>
            Shipping, delivery, and return terms are governed by our{' '}
            <a href="/shipping">Shipping &amp; Returns Policy</a>, which is
            incorporated into these Terms by reference.
          </p>

          <h2>7. Intellectual Property</h2>
          <p>
            All content on the Services &mdash; including text, graphics, logos,
            product images, video, audio, and software &mdash; is the property
            of Rush N Relax or its licensors and is protected by U.S. and
            international copyright, trademark, trade-dress, and other
            intellectual-property laws. The &ldquo;Rush N Relax&rdquo; name and
            logo are trademarks of Rush N Relax.
          </p>
          <p>Without our prior written consent, you may not:</p>
          <ul>
            <li>
              Copy, reproduce, distribute, republish, or create derivative works
              from any Services content;
            </li>
            <li>
              Use our trademarks, trade dress, product names, or product images
              in any commercial context;
            </li>
            <li>
              Scrape, crawl, index, harvest, or extract data from the Services
              by automated means;
            </li>
            <li>
              Use the Services or its content to train, fine-tune, or evaluate
              any artificial-intelligence or machine-learning model;
            </li>
            <li>
              Frame, mirror, or repackage the Services or use them to operate a
              competing storefront.
            </li>
          </ul>
          <p>We reserve all rights not expressly granted.</p>

          <h2>8. User Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>
              Use the Services for any unlawful purpose or in violation of these
              Terms;
            </li>
            <li>Misrepresent your age, identity, or shipping address;</li>
            <li>
              Attempt to gain unauthorized access to the Services or interfere
              with their operation;
            </li>
            <li>
              Resell products purchased from us without our written
              authorization.
            </li>
          </ul>

          <h2>9. Disclaimers</h2>
          <p>
            THE SERVICES AND ALL PRODUCTS ARE PROVIDED{' '}
            <strong>&ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;</strong>{' '}
            WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED,
            INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. We do
            not warrant that the Services will be uninterrupted, error-free, or
            secure, or that any product will meet your expectations or produce
            any specific effect.
          </p>
          <p>
            Statements regarding products have not been evaluated by the FDA.
            Products are not intended to diagnose, treat, cure, or prevent any
            disease.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, RUSH N RELAX, ITS OFFICERS,
            EMPLOYEES, AFFILIATES, AND SUPPLIERS SHALL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE
            DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING
            OUT OF OR RELATING TO YOUR USE OF THE SERVICES OR ANY PRODUCTS
            PURCHASED, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH
            DAMAGES. OUR TOTAL AGGREGATE LIABILITY FOR ANY AND ALL CLAIMS SHALL
            NOT EXCEED THE AMOUNT YOU PAID FOR THE PRODUCT GIVING RISE TO THE
            CLAIM.
          </p>

          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Rush N Relax and
            its affiliates, officers, employees, and agents from any claims,
            damages, liabilities, losses, costs, and expenses (including
            reasonable attorneys&rsquo; fees) arising out of or relating to your
            use of the Services, your purchase or use of any product, your
            violation of these Terms, or your violation of any law or
            third-party right.
          </p>

          <h2>12. Marketing Communications (Email &amp; SMS)</h2>
          <p>
            If you opt in to receive marketing emails or text messages from Rush
            N Relax, you consent to receive recurring promotional,
            transactional, and informational messages at the email address or
            mobile number you provide.{' '}
            <strong>Message and data rates may apply.</strong> Message frequency
            varies. Consent is not a condition of any purchase.
          </p>
          <ul>
            <li>
              <strong>Email:</strong> Unsubscribe at any time using the link in
              any marketing email.
            </li>
            <li>
              <strong>SMS:</strong> Reply <strong>STOP</strong> to cancel or{' '}
              <strong>HELP</strong> for help. Carriers are not liable for
              delayed or undelivered messages.
            </li>
          </ul>
          <p>
            We comply with the federal CAN-SPAM Act and the Telephone Consumer
            Protection Act (TCPA). See our <a href="/privacy">Privacy Policy</a>{' '}
            for how we use the contact information you provide.
          </p>

          <h2>13. Force Majeure</h2>
          <p>
            Rush N Relax shall not be liable for any failure or delay in
            performance caused by circumstances beyond our reasonable control,
            including but not limited to acts of God, natural disasters, severe
            weather, pandemic, war, terrorism, civil unrest, labor disputes,
            carrier delays or failures, supply-chain disruption, utility or
            telecommunications failure, hosting or payment-processor outages,
            banking or financial-services interruptions, and changes in hemp or
            cannabis law, regulation, or enforcement at the federal, state, or
            local level.
          </p>

          <h2>14. Binding Arbitration &amp; Class-Action Waiver</h2>
          <p>
            <strong>
              PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR RIGHTS.
            </strong>
          </p>
          <p>
            Any dispute, claim, or controversy arising out of or relating to
            these Terms, the Services, or any product purchased from Rush N
            Relax (a &ldquo;Dispute&rdquo;) shall be resolved exclusively by{' '}
            <strong>binding individual arbitration</strong> administered by the
            American Arbitration Association (AAA) under its Consumer
            Arbitration Rules then in effect. The arbitration shall take place
            in Anderson County, Tennessee, or remotely by agreement of the
            parties. The arbitrator&rsquo;s decision shall be final and binding.
            Judgment on the award may be entered in any court of competent
            jurisdiction.
          </p>
          <p>
            <strong>Class-Action Waiver.</strong> You and Rush N Relax agree
            that Disputes shall be brought only in an individual capacity and{' '}
            <strong>
              not as a plaintiff or class member in any class, collective,
              consolidated, mass, or representative proceeding.
            </strong>{' '}
            The arbitrator may not consolidate more than one person&rsquo;s
            claims and may not preside over any form of class or representative
            proceeding.
          </p>
          <p>
            <strong>Jury-Trial Waiver.</strong> To the fullest extent permitted
            by law, you and Rush N Relax knowingly and voluntarily{' '}
            <strong>waive any right to a trial by jury</strong> in any
            proceeding arising out of or relating to these Terms or the
            Services.
          </p>
          <p>
            <strong>Small-Claims Carveout.</strong> Either party may bring an
            individual claim in small-claims court in Anderson County,
            Tennessee, in lieu of arbitration, so long as the claim remains in
            that court and is not removed or appealed to a court of general
            jurisdiction.
          </p>
          <p>
            <strong>Opt-Out.</strong> You may opt out of this arbitration
            provision by sending written notice to the contact address in
            Section 19 within <strong>30 days</strong> of first accepting these
            Terms. Your notice must include your name, the email address used
            for your account, and a clear statement that you wish to opt out of
            arbitration.
          </p>

          <h2>15. Governing Law &amp; Venue</h2>
          <p>
            These Terms are governed by the laws of the State of Tennessee and
            the Federal Arbitration Act, without regard to conflict-of-laws
            principles. Subject to Section 14, any Dispute not subject to
            arbitration shall be resolved exclusively in the state or federal
            courts located in Anderson County, Tennessee, and you consent to the
            personal jurisdiction of such courts.
          </p>

          <h2>16. Severability</h2>
          <p>
            If any provision of these Terms is held invalid, illegal, or
            unenforceable by a court or arbitrator of competent jurisdiction,
            that provision shall be modified to the minimum extent necessary to
            make it enforceable, or, if it cannot be modified, severed from
            these Terms. The remaining provisions shall remain in full force and
            effect. If the class-action waiver in Section 14 is found
            unenforceable, then the entirety of Section 14 shall be void, but
            the remainder of these Terms shall survive.
          </p>

          <h2>17. Entire Agreement</h2>
          <p>
            These Terms, together with the <a href="/privacy">Privacy Policy</a>{' '}
            and <a href="/shipping">Shipping &amp; Returns Policy</a>,
            constitute the entire agreement between you and Rush N Relax with
            respect to the Services and supersede all prior agreements,
            communications, and understandings, whether written or oral.
          </p>

          <h2>18. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. The &ldquo;Last
            Updated&rdquo; date above reflects the most recent revision.
            Continued use of the Services after changes are posted constitutes
            acceptance of the revised Terms.
          </p>

          <h2>19. Contact</h2>
          <p>Questions about these Terms? Contact us at:</p>
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
