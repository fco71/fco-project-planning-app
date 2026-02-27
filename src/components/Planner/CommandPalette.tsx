import type { RefObject } from "react";
import type { PaletteItem } from "../../hooks/usePlannerPaletteItems";

type CommandPaletteProps = {
  open: boolean;
  query: string;
  paletteIndex: number;
  items: PaletteItem[];
  inputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSetIndex: (index: number) => void;
  onRunItem: (item: PaletteItem) => void;
};

export function CommandPalette({
  open,
  query,
  paletteIndex,
  items,
  inputRef,
  onClose,
  onQueryChange,
  onSetIndex,
  onRunItem,
}: CommandPaletteProps) {
  if (!open) return null;

  return (
    <div className="planner-palette-backdrop" onClick={onClose}>
      <div className="planner-palette" onClick={(event) => event.stopPropagation()}>
        <input
          data-testid="planner-command-palette-input"
          ref={inputRef}
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            onSetIndex(0);
          }}
          placeholder="Type a command, node, or entity..."
        />
        <div className="planner-palette-list">
          {items.length === 0 ? (
            <div className="planner-palette-empty">No matches</div>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                className={`planner-palette-item ${index === paletteIndex ? "active" : ""}`}
                data-testid="planner-command-palette-item"
                onMouseEnter={() => onSetIndex(index)}
                onClick={() => onRunItem(item)}
              >
                <span>{item.label}</span>
                {item.hint ? <span>{item.hint}</span> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
