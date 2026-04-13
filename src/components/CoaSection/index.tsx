import './CoaSection.css';
import type { CoaDocument } from '@/types';

interface CoaSectionProps {
  docs: CoaDocument[];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CoaSection({ docs }: CoaSectionProps) {
  return (
    <section id="coa-documents" className="coa-section">
      <div className="container">
        <h2 className="coa-section__heading">Certificates of Analysis</h2>
        <p className="coa-section__subtext">
          Our COA documents are third-party lab results verifying the potency
          and purity of our products.
        </p>

        {docs.length === 0 ? (
          <p className="coa-section__empty">
            No COA documents are currently available.
          </p>
        ) : (
          <ul className="coa-section__list">
            {docs.map(doc => (
              <li key={doc.name} className="coa-section__item">
                <span className="coa-section__icon" aria-hidden="true">
                  📄
                </span>
                <div className="coa-section__info">
                  <span className="coa-section__label">{doc.label}</span>
                  <span className="coa-section__size">
                    {formatFileSize(doc.size)}
                  </span>
                </div>
                <a
                  href={doc.downloadUrl}
                  className="coa-section__download"
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  Download PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
