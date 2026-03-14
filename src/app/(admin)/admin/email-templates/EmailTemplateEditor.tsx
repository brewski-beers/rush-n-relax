'use client';

import { useActionState, useMemo, useState } from 'react';
import { saveEmailTemplate, sendTestEmail } from './actions';
import {
  createEmailPreviewDocument,
  renderContactSubmissionEmailHtml,
} from '@/lib/email-template-renderer';
import type {
  ContactSubmissionPayload,
  EmailTemplate,
  EmailTemplateBlock,
  EmailTemplateContainer,
  EmailTemplateValuePath,
} from '@/types';

interface Props {
  initialTemplate: EmailTemplate;
}

const SAMPLE_PAYLOAD: ContactSubmissionPayload = {
  submissionId: 'sample-submission-001',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1 (865) 555-0102',
  message:
    'Hi team, I had a great experience and wanted to ask about upcoming promotions for this weekend.',
  submittedAtIso: new Date().toISOString(),
  userAgent: 'Mozilla/5.0',
};

const VALUE_PATH_OPTIONS: EmailTemplateValuePath[] = [
  'name',
  'email',
  'phone',
  'message',
  'submittedAtIso',
  'submissionId',
  'userAgent',
];

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function EmailTemplateEditor({ initialTemplate }: Props) {
  const [state, formAction, pending] = useActionState(saveEmailTemplate, null);
  const [testState, testAction, testPending] = useActionState(
    sendTestEmail,
    null
  );
  const [template, setTemplate] = useState<EmailTemplate>(initialTemplate);

  const initialTemplateJson = useMemo(
    () => JSON.stringify(initialTemplate),
    [initialTemplate]
  );
  const templateJson = useMemo(() => JSON.stringify(template), [template]);
  const previewHtml = useMemo(
    () => renderContactSubmissionEmailHtml(SAMPLE_PAYLOAD, template),
    [template]
  );
  const previewDocument = useMemo(
    () => createEmailPreviewDocument(previewHtml),
    [previewHtml]
  );
  const hasUnsavedChanges = templateJson !== initialTemplateJson;

  const onContainerDragStart = (
    event: React.DragEvent,
    containerIndex: number
  ) => {
    event.dataTransfer.setData(
      'application/x-rnr-template-drag',
      JSON.stringify({ kind: 'container', containerIndex })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  const onBlockDragStart = (
    event: React.DragEvent,
    containerIndex: number,
    blockIndex: number
  ) => {
    event.dataTransfer.setData(
      'application/x-rnr-template-drag',
      JSON.stringify({ kind: 'block', containerIndex, blockIndex })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  const onContainerDrop = (
    event: React.DragEvent,
    targetContainerIndex: number
  ) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/x-rnr-template-drag');
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as {
        kind: 'container' | 'block';
        containerIndex: number;
        blockIndex?: number;
      };

      if (payload.kind === 'container') {
        setTemplate(prev => {
          const nextContainers = [...prev.containers];
          const [moved] = nextContainers.splice(payload.containerIndex, 1);
          nextContainers.splice(targetContainerIndex, 0, moved);
          return { ...prev, containers: nextContainers };
        });
        return;
      }

      if (payload.kind === 'block' && typeof payload.blockIndex === 'number') {
        const sourceBlockIndex = payload.blockIndex;
        setTemplate(prev => {
          const nextContainers = [...prev.containers];
          const sourceContainer = nextContainers[payload.containerIndex];
          const targetContainer = nextContainers[targetContainerIndex];
          if (!sourceContainer || !targetContainer) return prev;

          const sourceBlocks = [...sourceContainer.blocks];
          const [movedBlock] = sourceBlocks.splice(sourceBlockIndex, 1);
          if (!movedBlock) return prev;

          nextContainers[payload.containerIndex] = {
            ...sourceContainer,
            blocks: sourceBlocks,
          };

          nextContainers[targetContainerIndex] = {
            ...targetContainer,
            blocks: [...targetContainer.blocks, movedBlock],
          };

          return {
            ...prev,
            containers: nextContainers,
          };
        });
      }
    } catch {
      // Ignore malformed drag payload
    }
  };

  const onBlockDrop = (
    event: React.DragEvent,
    targetContainerIndex: number,
    targetBlockIndex: number
  ) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/x-rnr-template-drag');
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as {
        kind: 'container' | 'block';
        containerIndex: number;
        blockIndex?: number;
      };
      if (payload.kind !== 'block' || typeof payload.blockIndex !== 'number') {
        return;
      }

      const sourceBlockIndex = payload.blockIndex;

      setTemplate(prev => {
        const nextContainers = [...prev.containers];
        const sourceContainer = nextContainers[payload.containerIndex];
        const targetContainer = nextContainers[targetContainerIndex];
        if (!sourceContainer || !targetContainer) return prev;

        const sourceBlocks = [...sourceContainer.blocks];
        const [movedBlock] = sourceBlocks.splice(sourceBlockIndex, 1);
        if (!movedBlock) return prev;

        const targetBlocks = [...targetContainer.blocks];
        targetBlocks.splice(targetBlockIndex, 0, movedBlock);

        nextContainers[payload.containerIndex] = {
          ...sourceContainer,
          blocks: sourceBlocks,
        };

        nextContainers[targetContainerIndex] = {
          ...targetContainer,
          blocks: targetBlocks,
        };

        return {
          ...prev,
          containers: nextContainers,
        };
      });
    } catch {
      // Ignore malformed drag payload
    }
  };

  const addContainer = () => {
    setTemplate(prev => ({
      ...prev,
      containers: [
        ...prev.containers,
        {
          id: createId('container'),
          label: `Container ${prev.containers.length + 1}`,
          blocks: [],
        },
      ],
    }));
  };

  const removeContainer = (containerIndex: number) => {
    setTemplate(prev => ({
      ...prev,
      containers: prev.containers.filter(
        (_, index) => index !== containerIndex
      ),
    }));
  };

  const addBlock = (
    containerIndex: number,
    type: EmailTemplateBlock['type']
  ) => {
    const newBlock: EmailTemplateBlock =
      type === 'heading'
        ? { id: createId('block'), type, text: 'Heading text' }
        : type === 'paragraph'
          ? { id: createId('block'), type, text: 'Paragraph text' }
          : type === 'keyValue'
            ? {
                id: createId('block'),
                type,
                label: 'Label',
                valuePath: 'name',
              }
            : type === 'message'
              ? { id: createId('block'), type, label: 'Message' }
              : type === 'divider'
                ? { id: createId('block'), type }
                : { id: createId('block'), type, heightPx: 16 };

    setTemplate(prev => {
      const nextContainers = [...prev.containers];
      const container = nextContainers[containerIndex];
      if (!container) return prev;

      nextContainers[containerIndex] = {
        ...container,
        blocks: [...container.blocks, newBlock],
      };

      return { ...prev, containers: nextContainers };
    });
  };

  const removeBlock = (containerIndex: number, blockIndex: number) => {
    setTemplate(prev => {
      const nextContainers = [...prev.containers];
      const container = nextContainers[containerIndex];
      if (!container) return prev;
      nextContainers[containerIndex] = {
        ...container,
        blocks: container.blocks.filter((_, index) => index !== blockIndex),
      };
      return { ...prev, containers: nextContainers };
    });
  };

  const updateContainer = (
    containerIndex: number,
    updater: (container: EmailTemplateContainer) => EmailTemplateContainer
  ) => {
    setTemplate(prev => {
      const nextContainers = [...prev.containers];
      const target = nextContainers[containerIndex];
      if (!target) return prev;
      nextContainers[containerIndex] = updater(target);
      return { ...prev, containers: nextContainers };
    });
  };

  const updateBlock = (
    containerIndex: number,
    blockIndex: number,
    updater: (block: EmailTemplateBlock) => EmailTemplateBlock
  ) => {
    updateContainer(containerIndex, container => ({
      ...container,
      blocks: container.blocks.map((block, index) =>
        index === blockIndex ? updater(block) : block
      ),
    }));
  };

  return (
    <div className="admin-form admin-email-editor-form">
      {state?.error ? <p className="admin-error">{state.error}</p> : null}
      {state?.success ? (
        <p className="admin-section-desc">{state.success}</p>
      ) : null}

      <div className="admin-email-editor-grid">
        <section className="admin-email-editor-panel">
          <h2 className="admin-section-title">Template Config</h2>

          <label>
            Template Name
            <input
              value={template.name}
              onChange={event =>
                setTemplate(prev => ({ ...prev, name: event.target.value }))
              }
            />
          </label>

          <label>
            Subject Template
            <input
              value={template.subjectTemplate}
              onChange={event =>
                setTemplate(prev => ({
                  ...prev,
                  subjectTemplate: event.target.value,
                }))
              }
              placeholder="New contact submission from {{name}}"
            />
          </label>

          <label>
            Status
            <select
              value={template.status}
              onChange={event =>
                setTemplate(prev => ({
                  ...prev,
                  status:
                    event.target.value === 'draft' ? 'draft' : 'published',
                }))
              }
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </label>

          <div className="admin-email-theme-grid">
            <label>
              Background
              <input
                type="color"
                value={template.theme.backgroundColor}
                onChange={event =>
                  setTemplate(prev => ({
                    ...prev,
                    theme: {
                      ...prev.theme,
                      backgroundColor: event.target.value,
                    },
                  }))
                }
              />
            </label>

            <label>
              Panel
              <input
                type="color"
                value={template.theme.panelColor}
                onChange={event =>
                  setTemplate(prev => ({
                    ...prev,
                    theme: { ...prev.theme, panelColor: event.target.value },
                  }))
                }
              />
            </label>

            <label>
              Text
              <input
                type="color"
                value={template.theme.textColor}
                onChange={event =>
                  setTemplate(prev => ({
                    ...prev,
                    theme: { ...prev.theme, textColor: event.target.value },
                  }))
                }
              />
            </label>

            <label>
              Accent
              <input
                type="color"
                value={template.theme.accentColor}
                onChange={event =>
                  setTemplate(prev => ({
                    ...prev,
                    theme: { ...prev.theme, accentColor: event.target.value },
                  }))
                }
              />
            </label>

            <label>
              Muted Text
              <input
                type="color"
                value={template.theme.mutedTextColor}
                onChange={event =>
                  setTemplate(prev => ({
                    ...prev,
                    theme: {
                      ...prev.theme,
                      mutedTextColor: event.target.value,
                    },
                  }))
                }
              />
            </label>

            <label>
              Border
              <input
                type="color"
                value={template.theme.borderColor}
                onChange={event =>
                  setTemplate(prev => ({
                    ...prev,
                    theme: { ...prev.theme, borderColor: event.target.value },
                  }))
                }
              />
            </label>
          </div>

          <label>
            Font Family
            <input
              value={template.theme.fontFamily}
              onChange={event =>
                setTemplate(prev => ({
                  ...prev,
                  theme: { ...prev.theme, fontFamily: event.target.value },
                }))
              }
            />
          </label>

          <label>
            Border Radius (px)
            <input
              type="number"
              min={0}
              max={40}
              value={template.theme.borderRadiusPx}
              onChange={event =>
                setTemplate(prev => ({
                  ...prev,
                  theme: {
                    ...prev.theme,
                    borderRadiusPx: Number(event.target.value) || 0,
                  },
                }))
              }
            />
          </label>

          <div className="admin-form-actions">
            <button
              type="button"
              onClick={addContainer}
              className="admin-btn-secondary"
            >
              Add Container
            </button>
            <form
              action={formAction}
              className="admin-inline-form admin-inline-form-compact"
            >
              <input
                type="hidden"
                name="templateJson"
                value={templateJson}
                readOnly
              />
              <button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save Template'}
              </button>
            </form>
          </div>

          <div className="admin-email-test-send-box">
            <h3 className="admin-section-title">Test Send</h3>
            <p className="admin-section-desc">
              Queue a synthetic contact submission email to verify the current
              template in the delivery pipeline.
            </p>
            {testState?.error ? (
              <p className="admin-error">{testState.error}</p>
            ) : null}
            {testState?.success ? (
              <p className="admin-section-desc">{testState.success}</p>
            ) : null}
            <div className="admin-email-test-send-row">
              <form action={testAction} className="admin-inline-form">
                <input
                  type="hidden"
                  name="templateId"
                  value={template.id}
                  readOnly
                />
                <input
                  type="hidden"
                  name="templateJson"
                  value={templateJson}
                  readOnly
                />
                <input
                  name="to"
                  type="email"
                  placeholder="qa@example.com"
                  required
                />
                <button type="submit" disabled={testPending}>
                  {testPending ? 'Queueing…' : 'Queue Test Email'}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="admin-email-editor-panel">
          <h2 className="admin-section-title">Container Builder</h2>
          <p className="admin-section-desc">
            Drag containers and blocks to reorder. Click preview text to edit in
            place.
          </p>

          <div className="admin-email-container-list">
            {template.containers.map((container, containerIndex) => (
              <div
                key={container.id}
                className="admin-email-container-item"
                draggable
                onDragStart={event =>
                  onContainerDragStart(event, containerIndex)
                }
                onDragOver={event => event.preventDefault()}
                onDrop={event => onContainerDrop(event, containerIndex)}
              >
                <div className="admin-email-container-head">
                  <input
                    value={container.label}
                    onChange={event =>
                      updateContainer(containerIndex, current => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => removeContainer(containerIndex)}
                  >
                    Remove
                  </button>
                </div>

                <div className="admin-email-block-list">
                  {container.blocks.map((block, blockIndex) => (
                    <div
                      key={block.id}
                      className="admin-email-block-item"
                      draggable
                      onDragStart={event =>
                        onBlockDragStart(event, containerIndex, blockIndex)
                      }
                      onDragOver={event => event.preventDefault()}
                      onDrop={event =>
                        onBlockDrop(event, containerIndex, blockIndex)
                      }
                    >
                      <div className="admin-email-block-head">
                        <strong>{block.type}</strong>
                        <button
                          type="button"
                          className="admin-btn-secondary"
                          onClick={() =>
                            removeBlock(containerIndex, blockIndex)
                          }
                        >
                          Remove
                        </button>
                      </div>

                      {block.type === 'heading' ||
                      block.type === 'paragraph' ? (
                        <input
                          value={block.text}
                          onChange={event =>
                            updateBlock(containerIndex, blockIndex, current =>
                              current.type === 'heading' ||
                              current.type === 'paragraph'
                                ? { ...current, text: event.target.value }
                                : current
                            )
                          }
                        />
                      ) : null}

                      {block.type === 'keyValue' ? (
                        <>
                          <input
                            value={block.label}
                            onChange={event =>
                              updateBlock(
                                containerIndex,
                                blockIndex,
                                current =>
                                  current.type === 'keyValue'
                                    ? { ...current, label: event.target.value }
                                    : current
                              )
                            }
                          />
                          <select
                            value={block.valuePath}
                            onChange={event =>
                              updateBlock(
                                containerIndex,
                                blockIndex,
                                current =>
                                  current.type === 'keyValue'
                                    ? {
                                        ...current,
                                        valuePath: event.target
                                          .value as EmailTemplateValuePath,
                                      }
                                    : current
                              )
                            }
                          >
                            {VALUE_PATH_OPTIONS.map(valuePath => (
                              <option key={valuePath} value={valuePath}>
                                {valuePath}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : null}

                      {block.type === 'message' ? (
                        <input
                          value={block.label}
                          onChange={event =>
                            updateBlock(containerIndex, blockIndex, current =>
                              current.type === 'message'
                                ? { ...current, label: event.target.value }
                                : current
                            )
                          }
                        />
                      ) : null}

                      {block.type === 'spacer' ? (
                        <input
                          type="number"
                          min={4}
                          max={120}
                          value={block.heightPx}
                          onChange={event =>
                            updateBlock(containerIndex, blockIndex, current =>
                              current.type === 'spacer'
                                ? {
                                    ...current,
                                    heightPx: Number(event.target.value) || 16,
                                  }
                                : current
                            )
                          }
                        />
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="admin-email-block-add-row">
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => addBlock(containerIndex, 'heading')}
                  >
                    + Heading
                  </button>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => addBlock(containerIndex, 'paragraph')}
                  >
                    + Paragraph
                  </button>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => addBlock(containerIndex, 'keyValue')}
                  >
                    + Key/Value
                  </button>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => addBlock(containerIndex, 'message')}
                  >
                    + Message
                  </button>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => addBlock(containerIndex, 'divider')}
                  >
                    + Divider
                  </button>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => addBlock(containerIndex, 'spacer')}
                  >
                    + Spacer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-email-editor-panel admin-email-preview-panel">
          <h2 className="admin-section-title">Live Preview</h2>
          <p className="admin-section-desc">
            This preview uses the same rendered HTML that test sends and queued
            emails use. Edit content in Container Builder and Template Config.
          </p>
          {hasUnsavedChanges ? (
            <p className="admin-section-desc">
              Unsaved changes are included in test sends from this screen.
            </p>
          ) : null}

          <iframe
            title="Rendered email preview"
            className="admin-email-preview-frame"
            srcDoc={previewDocument}
            sandbox=""
          />
        </section>
      </div>
    </div>
  );
}
