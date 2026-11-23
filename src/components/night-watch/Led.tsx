import type { Tone } from "@/lib/status";
import { LED_BG } from "@/components/night-watch/tones";

type LedProps = { tone: Tone; pulse?: boolean };

const Led = ({ tone, pulse = false }: LedProps) => (
  <i aria-hidden className={`inline-block size-[7px] shrink-0 rounded-full ${LED_BG[tone]} ${pulse ? "animate-led" : ""}`} />
);

export default Led;
