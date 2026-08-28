"use client";

import { WebsiteReplica } from "@/components/replica/WebsiteReplica";
import { VoiceGovAssistant } from "./VoiceGovAssistant";

/**
 * The replica is the full-screen primary environment. VoiceGov rides along as
 * a floating side assistant that operates the website.
 */
export function VoiceGovApp() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <WebsiteReplica />
      <VoiceGovAssistant />
    </div>
  );
}
