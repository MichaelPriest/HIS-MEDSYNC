"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function StatusToast({ success, error }: { success?: string | null; error?: string | null }) {
  useEffect(() => {
    if (success) toast.success(success);
    if (error) toast.error(error);
  }, [success, error]);

  return null;
}
