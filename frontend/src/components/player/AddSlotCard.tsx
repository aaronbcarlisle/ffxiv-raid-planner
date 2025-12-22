interface AddSlotCardProps {
  onAdd: () => void;
}

export function AddSlotCard({ onAdd }: AddSlotCardProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="w-full bg-bg-card border-2 border-dashed border-border-default rounded-lg p-4 transition-all hover:border-solid hover:border-accent hover:bg-bg-hover group flex items-center justify-center gap-2 min-h-[76px]"
    >
      <span className="text-2xl text-text-muted group-hover:text-accent transition-colors">+</span>
      <span className="text-text-muted group-hover:text-text-secondary transition-colors">
        Add Player Slot
      </span>
    </button>
  );
}
