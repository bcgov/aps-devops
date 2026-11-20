import { useEffect } from "react";
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
} from "@bcgov/design-system-react-components";

export function IslandOverflowActions({
  id,
  labels,
}: {
  id: string;
  labels: string[];
}) {
  useEffect(() => {
    const fallback = document.getElementById(id);
    if (!fallback) return;
    fallback.hidden = true;
    return () => {
      fallback.hidden = false;
    };
  }, [id]);

  return (
    <MenuTrigger>
      <Button
        isIconButton
        variant="secondary"
        size="small"
        aria-label="Additional actions"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </svg>
      </Button>
      <Menu placement="bottom end">
        {labels.map((label, index) => (
          <MenuItem
            key={label}
            label={label}
            onAction={() => {
              document.getElementById(id)
                ?.querySelector<HTMLButtonElement>(
                  `[data-overflow-index="${index}"] button`,
                )
                ?.click();
            }}
          />
        ))}
      </Menu>
    </MenuTrigger>
  );
}
