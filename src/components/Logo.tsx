"use client";

import Image from "next/image";

/**
 * SkillBridge logo — uses the icon extracted from Esmeralda's mockup.
 * Two interlocking diamond shapes representing skill bridging.
 */
export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: 24, md: 32, lg: 40 };
  const text = { sm: "text-lg", md: "text-xl", lg: "text-2xl" };
  const px = dims[size];

  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/skillbridge_icon.png"
        alt="SkillBridge"
        width={px}
        height={px}
        className="shrink-0"
      />
      <span className={`${text[size]} font-bold tracking-tight`}>
        <span className="text-sky-400">Skill</span>
        <span className="text-current">Bridge</span>
      </span>
    </span>
  );
}
