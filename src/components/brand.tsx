import Link from "next/link";
import Image from "next/image";

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="StudyStation home">
      <Image
        src="/logo.png"
        alt=""
        width={36}
        height={36}
        priority
        className="size-9 shrink-0 rounded-[11px] object-cover"
      />
      {!compact && (
        <span className={`text-[21px] font-extrabold tracking-[-0.7px] ${inverse ? "text-white" : "text-[#17132d]"}`}>
          StudyStation
        </span>
      )}
    </Link>
  );
}
