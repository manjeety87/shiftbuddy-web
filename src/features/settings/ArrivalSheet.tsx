"use client";

import { useRef, useState } from "react";
import { FormError } from "@/components/ui/Field";
import { Sheet, type SheetHandle } from "@/components/ui/Sheet";
import { WheelPicker } from "@/components/ui/WheelPicker";
import { errorMessage } from "@/lib/api";
import { updateProfile } from "@/lib/auth";
import { ARRIVAL_BUFFER_MAX_MINUTES, describeArriveByExample } from "@/lib/commute";
import { notify } from "@/lib/notify";
import { useSession, useUser } from "@/lib/session";

const MINUTES = Array.from({ length: ARRIVAL_BUFFER_MAX_MINUTES + 1 }, (_, minutes) => minutes);

/**
 * "Custom" arrival time: a minutes wheel like the iOS timer, the same as the phone
 * app's. Saved only with Set, so spinning past values commits nothing.
 */
export function ArrivalSheet({ onClose }: { onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const user = useUser();
  const { setUser } = useSession();
  const [minutes, setMinutes] = useState(user.arrivalBufferMinutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    try {
      setUser(await updateProfile({ arrivalBufferMinutes: minutes }));
      sheet.current?.dismiss();
      notify.success(minutes === 0 ? "You’ll arrive right on time" : `You’ll arrive ${minutes} min early`);
    } catch (failure) {
      setError(errorMessage(failure, "Couldn’t save that."));
      setBusy(false);
    }
  };

  return (
    <Sheet ref={sheet} title="Arrive Early" onClose={onClose} isDirty={minutes !== user.arrivalBufferMinutes} action={{ label: "Set", onClick: save, busy }}>
      <FormError>{error}</FormError>
      <div className="mx-auto flex w-64 items-center justify-center gap-3">
        <div className="w-20">
          <WheelPicker values={MINUTES} value={minutes} onChange={setMinutes} label="Minutes early" format={(value) => String(value)} />
        </div>
        {/* Fixed beside the wheel, like the iOS timer's "min" */}
        <span className="w-24 text-lg font-semibold">min early</span>
      </div>
      <p aria-live="polite" className="mt-4 mb-2 text-center text-sm text-muted-foreground tabular-nums">
        {minutes === 0 ? "Right on time — no room for a late bus." : describeArriveByExample(minutes)}
      </p>
    </Sheet>
  );
}
