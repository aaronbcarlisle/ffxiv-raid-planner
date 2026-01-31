/**
 * Role Based Priority Editor
 *
 * DnD-reorderable list of roles for role-based priority mode.
 * Ported from GroupSettingsModal priority tab.
 */

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '../primitives';
import type { RoleType } from '../../types';

// Role display names
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  melee: 'Melee DPS',
  ranged: 'Physical Ranged',
  caster: 'Magical Ranged',
  tank: 'Tank',
  healer: 'Healer',
};

// Role colors for visual distinction
const ROLE_COLORS: Record<string, string> = {
  tank: 'border-l-role-tank',
  healer: 'border-l-role-healer',
  melee: 'border-l-role-melee',
  ranged: 'border-l-role-ranged',
  caster: 'border-l-role-caster',
};

// Default role order
const DEFAULT_ROLE_ORDER: RoleType[] = ['melee', 'ranged', 'caster', 'tank', 'healer'];

// Sortable role item component
function SortableRoleItem({
  role,
  index,
  disabled,
}: {
  role: string;
  index: number;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Stop touch events from propagating to parent swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 bg-surface-elevated border border-border-default border-l-4 ${
        ROLE_COLORS[role] || ''
      } rounded-lg select-none touch-none ${
        isDragging ? 'opacity-50 shadow-lg z-50' : ''
      } ${disabled ? 'opacity-50' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      {...attributes}
      {...listeners}
    >
      <span
        className={`text-text-muted ${
          disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <GripVertical className="w-5 h-5" />
      </span>
      <span className="text-text-secondary font-medium w-6">{index + 1}.</span>
      <span className="text-text-primary">{ROLE_DISPLAY_NAMES[role] || role}</span>
      <span className="ml-auto text-xs text-text-muted">
        +{(5 - index) * 25} priority
      </span>
    </div>
  );
}

interface RoleBasedEditorProps {
  roleOrder: RoleType[];
  onChange: (roleOrder: RoleType[]) => void;
  disabled?: boolean;
}

export function RoleBasedEditor({ roleOrder, onChange, disabled }: RoleBasedEditorProps) {
  // DnD sensors with activation constraint for better touch handling
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = roleOrder.indexOf(active.id as RoleType);
      const newIndex = roleOrder.indexOf(over.id as RoleType);
      onChange(arrayMove(roleOrder, oldIndex, newIndex));
    }
  };

  const handleReset = () => {
    onChange([...DEFAULT_ROLE_ORDER]);
  };

  const isDefaultOrder = JSON.stringify(roleOrder) === JSON.stringify(DEFAULT_ROLE_ORDER);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-text-secondary text-sm mb-3">
          Drag to reorder role priority. Roles higher in the list get more priority points
          for loot distribution.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={roleOrder} strategy={verticalListSortingStrategy}>
          <div className={`space-y-2 ${disabled ? 'pointer-events-none' : ''}`}>
            {roleOrder.map((role, index) => (
              <SortableRoleItem key={role} role={role} index={index} disabled={disabled} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleReset}
        disabled={disabled || isDefaultOrder}
      >
        <RotateCcw className="w-4 h-4 mr-1.5" />
        Reset to Default
      </Button>
    </div>
  );
}
