import { phoneEnabled } from "@/lib/sms";
import type { CurrentUser } from "@/lib/types";

/** Reminders can be texted to this member: texting is on for the ward and they agreed to texts. */
export const memberCanText = (user: CurrentUser) => phoneEnabled() && !!user.ward.texting_enabled && !!user.sms_consent_at && !!user.phone;
