"use client";

import { Check } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import type { FeatureKey } from "@/interfaces/user.d";
import { errorMessage } from "@/lib/api";
import { CORE_FEATURES, featuresOf, setFeature, type FeatureInfo } from "@/lib/features";
import { notify } from "@/lib/notify";
import { useSession, useUser } from "@/lib/session";

/**
 * Switch account features on and off. The switch moves at once (a control that waits
 * for the server feels broken) and goes back if saving fails.
 */
export function useFeatureToggle() {
  const user = useUser();
  const { setUser } = useSession();
  const features = featuresOf(user);

  const toggle = async (key: FeatureKey, on: boolean) => {
    setUser({ ...user, features: { ...features, [key]: on } });
    try {
      setUser(await setFeature(key, on));
    } catch (failure) {
      setUser(user);
      notify.error("Couldn’t save that", { description: errorMessage(failure) });
    }
  };

  return { features, toggle };
}

/**
 * Features as rows inside the surface they're placed in, each with its switch. A
 * feature that needs another (Add my hours → Clock in) sits indented under it and
 * shows only while that one is on.
 */
export function FeatureSwitches({ items }: { items: FeatureInfo[] }) {
  const { features, toggle } = useFeatureToggle();
  return items
    .filter((item) => !item.requires || features[item.requires])
    .map((item) => (
      <div
        key={item.key}
        className={`flex items-center gap-4 py-3.5 pr-4 transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0 ${item.requires ? "pl-9" : "pl-4"}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{item.title}</p>
          <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{item.detail}</p>
        </div>
        <Switch label={item.title} checked={features[item.key]} onChange={(on) => toggle(item.key, on)} />
      </div>
    ));
}

/** What's always there, ticked — so nobody wonders whether the basics need switching on. */
export function CoreFeatures() {
  return CORE_FEATURES.map((item) => (
    <div key={item.title} className="flex items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{item.detail}</p>
      </div>
      <Check aria-label="Always on" className="size-4 shrink-0 text-success" />
    </div>
  ));
}
