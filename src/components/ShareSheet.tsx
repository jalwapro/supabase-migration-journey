import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Copy, MessageCircle, Send, Facebook, Twitter, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  facebookShareUrl,
  telegramShareUrl,
  twitterShareUrl,
  whatsappShareUrl,
  share as nativeShare,
  type ShareTarget,
} from "@/lib/share";

export function ShareSheet({
  open,
  onOpenChange,
  target,
  title = "Share",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: ShareTarget;
  title?: string;
}) {
  const items = [
    { label: "System share", icon: Share2, onClick: () => nativeShare(target) },
    { label: "WhatsApp",     icon: MessageCircle, href: whatsappShareUrl(target) },
    { label: "Telegram",     icon: Send,     href: telegramShareUrl(target) },
    { label: "Facebook",     icon: Facebook, href: facebookShareUrl(target) },
    { label: "X / Twitter",  icon: Twitter,  href: twitterShareUrl(target) },
    {
      label: "Copy link",
      icon: Copy,
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(target.url);
          toast.success("Link copied");
        } catch { toast.error("Copy failed"); }
      },
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-5">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {items.map((it) => {
            const inner = (
              <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/60 p-3 text-xs">
                <it.icon className="h-5 w-5 text-[color:var(--primary)]" />
                <span>{it.label}</span>
              </div>
            );
            if ("href" in it) {
              return (
                <a key={it.label} href={it.href} target="_blank" rel="noreferrer noopener" onClick={() => onOpenChange(false)}>
                  {inner}
                </a>
              );
            }
            return (
              <button key={it.label} type="button" onClick={async () => { await it.onClick(); onOpenChange(false); }}>
                {inner}
              </button>
            );
          })}
        </div>
        <p className="mt-4 break-all rounded-xl bg-muted p-2 text-[11px] text-muted-foreground">
          {target.url}
        </p>
      </SheetContent>
    </Sheet>
  );
}
