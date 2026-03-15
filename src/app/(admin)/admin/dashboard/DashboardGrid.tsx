'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const STORAGE_KEY = 'admin-dashboard-order';

interface DashboardCard {
  id: string;
  label: string;
  href: string;
}

const DEFAULT_CARDS: DashboardCard[] = [
  { id: 'locations', label: 'Manage Locations', href: '/admin/locations' },
  { id: 'products', label: 'Manage Products', href: '/admin/products' },
  { id: 'categories', label: 'Manage Categories', href: '/admin/categories' },
  { id: 'promos', label: 'Manage Promos', href: '/admin/promos' },
  { id: 'inventory', label: 'Manage Inventory', href: '/admin/inventory' },
  { id: 'users', label: 'Manage Users', href: '/admin/users' },
  { id: 'email-templates', label: 'Manage Email Templates', href: '/admin/email-templates' },
  { id: 'email-queue', label: 'Monitor Email Queue', href: '/admin/email-queue' },
];

function loadOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

function applyOrder(cards: DashboardCard[], order: string[]): DashboardCard[] {
  const cardMap = new Map(cards.map(c => [c.id, c]));
  const orderedIds = new Set(order);
  const ordered = order.flatMap(id => {
    const card = cardMap.get(id);
    return card ? [card] : [];
  });
  // Append any new cards not in saved order (e.g. newly added Categories)
  const newCards = cards.filter(c => !orderedIds.has(c.id));
  return [...ordered, ...newCards];
}

function SortableCard({ card }: { card: DashboardCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`dashboard-card-wrapper${isDragging ? ' dashboard-card-wrapper--dragging' : ''}`}
    >
      <button
        type="button"
        className="dashboard-card-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="4" cy="3" r="1.5" fill="currentColor" />
          <circle cx="10" cy="3" r="1.5" fill="currentColor" />
          <circle cx="4" cy="7" r="1.5" fill="currentColor" />
          <circle cx="10" cy="7" r="1.5" fill="currentColor" />
          <circle cx="4" cy="11" r="1.5" fill="currentColor" />
          <circle cx="10" cy="11" r="1.5" fill="currentColor" />
        </svg>
      </button>
      <Link href={card.href} className="dashboard-card">
        {card.label}
      </Link>
    </div>
  );
}

export function DashboardGrid() {
  const [cards, setCards] = useState<DashboardCard[]>(DEFAULT_CARDS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = loadOrder();
    if (saved) setCards(applyOrder(DEFAULT_CARDS, saved));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCards(prev => {
        const oldIndex = prev.findIndex(c => c.id === active.id);
        const newIndex = prev.findIndex(c => c.id === over.id);
        const next = arrayMove(prev, oldIndex, newIndex);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(c => c.id)));
        return next;
      });
    }
  }

  // SSR: render static cards without DnD context to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="dashboard-links">
        {cards.map(card => (
          <div key={card.id} className="dashboard-card-wrapper">
            <Link href={card.href} className="dashboard-card">
              {card.label}
            </Link>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={cards.map(c => c.id)} strategy={rectSortingStrategy}>
        <div className="dashboard-links">
          {cards.map(card => (
            <SortableCard key={card.id} card={card} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
