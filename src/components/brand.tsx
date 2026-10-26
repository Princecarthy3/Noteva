import Link from "next/link";
import Image from "next/image";

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex min-w-0 max-w-full items-center gap-2"
      aria-label="StudyStation home"
    >
      <Image
        src="/logo.png"
        alt=""
        width={36}
        height={36}
        priority
        className="size-8 shrink-0 rounded-[10px] object-cover sm:size-9 sm:rounded-[11px]"
      />
      {!compact && (
        <span
          className={`whitespace-nowrap text-[17px] font-extrabold tracking-[-0.6px] sm:text-[19px] ${
            inverse ? "text-white" : "text-[#17132d]"
          }`}
        >
          StudyStation
        </span>
      )}
    </Link>
  );
}
