interface EmptySlotCardProps {
  onStartEdit: () => void;
  onRemove?: () => void;
}

export function EmptySlotCard({ onStartEdit, onRemove }: EmptySlotCardProps) {
  return (
    <div className="w-full bg-bg-card border-2 border-dashed border-border-default rounded-lg p-4 transition-all hover:border-solid hover:border-accent hover:bg-bg-hover group">
      <div className="flex items-center gap-3">
        {/* Clickable area for edit */}
        <button
          type="button"
          onClick={onStartEdit}
          className="flex items-center gap-3 flex-1 text-left"
        >
          {/* Player icon placeholder */}
          <div className="w-10 h-10 rounded bg-bg-hover flex items-center justify-center text-xl text-text-muted opacity-50 group-hover:opacity-80 transition-opacity">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6"
            >
              <path
                fillRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Text */}
          <div>
            <div className="font-medium text-text-muted group-hover:text-text-secondary transition-colors">
              Player Slot
            </div>
            <div className="text-sm text-text-muted group-hover:text-text-secondary transition-colors">
              Click to configure
            </div>
          </div>
        </button>

        {/* Remove button */}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-8 h-8 rounded flex items-center justify-center text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
            title="Remove slot"
          >
            &minus;
          </button>
        )}
      </div>
    </div>
  );
}
