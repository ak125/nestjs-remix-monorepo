import { Info, AlertTriangle, Lightbulb, Wallet } from "lucide-react";
import { Alert } from "~/components/ui/alert";
import { type R6MediaSlotFrontend } from "~/types/r6-guide.types";

const CALLOUT_CONFIG: Record<string, { variant: string; icon: typeof Info }> = {
  info: { variant: "info", icon: Info },
  warning: { variant: "warning", icon: AlertTriangle },
  tip: { variant: "success", icon: Lightbulb },
  budget: { variant: "info", icon: Wallet },
};

function interpolateAlt(
  template: string,
  variables?: Record<string, string>,
  gammeName?: string,
): string {
  let result = template;
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      result = result.split(`{${key}}`).join(value);
    }
  }
  if (gammeName) {
    result = result.split("{gamme_name}").join(gammeName);
  }
  return result;
}

interface R6MediaSlotRendererProps {
  slots: R6MediaSlotFrontend[];
  gammeName: string;
  placement?: string;
}

export function R6MediaSlotRenderer({
  slots,
  gammeName,
  placement,
}: R6MediaSlotRendererProps) {
  const filtered = placement
    ? slots.filter((s) => s.placement === placement)
    : slots;

  if (!filtered.length) return null;

  return (
    <>
      {filtered.map((slot) => {
        const alt = interpolateAlt(
          slot.alt.template,
          slot.alt.variables,
          gammeName,
        );

        switch (slot.type) {
          case "image":
          case "diagram":
            return (
              <figure key={slot.slot_id} className="my-4">
                <img
                  src={slot.src || ""}
                  alt={alt}
                  loading={slot.loading || "lazy"}
                  fetchPriority={
                    slot.fetch_priority === "high" ? "high" : undefined
                  }
                  className="w-full rounded-lg border border-gray-200"
                />
                {slot.caption && (
                  <figcaption className="mt-1.5 text-xs text-gray-500 text-center">
                    {slot.caption}
                  </figcaption>
                )}
              </figure>
            );

          case "callout": {
            const config =
              CALLOUT_CONFIG[slot.callout_style || "info"] ||
              CALLOUT_CONFIG.info;
            const Icon = config.icon;
            return (
              <Alert
                key={slot.slot_id}
                variant={config.variant}
                icon={<Icon className="w-4 h-4" />}
                className="my-4"
              >
                {slot.content_hint || alt}
              </Alert>
            );
          }

          case "quote":
            return (
              <blockquote
                key={slot.slot_id}
                className="my-4 border-l-4 border-gray-300 pl-4 italic text-gray-600 text-sm"
              >
                {slot.content_hint || alt}
                {slot.caption && (
                  <footer className="mt-1 text-xs text-gray-400 not-italic">
                    — {slot.caption}
                  </footer>
                )}
              </blockquote>
            );

          // table, checklist, cards — rendered by dedicated block components
          default:
            return null;
        }
      })}
    </>
  );
}
