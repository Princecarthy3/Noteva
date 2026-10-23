import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Noteva home">
      <span className="relative grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#7259e8] text-[18px] font-black text-white shadow-[0_7px_18px_rgba(114,89,232,.3)]">
        N
        <Sparkles className="absolute -right-1.5 -top-1.5 size-3.5 fill-[#ffdf78] text-[#ffdf78]" aria-hidden="true" />
      </span>
      {!compact && (
        <span className={`text-[21px] font-extrabold tracking-[-0.7px] ${inverse ? "text-white" : "text-[#17132d]"}`}>
          noteva
        </span>
      )}
    </Link>
  );
}
