import { leadersWord, type Org } from "@/lib/types";
import type { Group } from "@/lib/groups";

/** Who can see a group and send messages to it. */
export function SenderChoices({ org, group }: { org: Pick<Org, "kind">; group?: Group }) {
  const leaders = leadersWord(org);
  return (
    <fieldset>
      <legend className="label">Who can see this group and send messages to it</legend>
      <div className="space-y-1 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="send_presidency" defaultChecked={group ? !!group.send_presidency : true} /> The {leaders}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="send_admins" defaultChecked={group ? !!group.send_admins : true} /> Admins
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="send_members" defaultChecked={group ? !!group.send_members : false} /> People in the group (from the Messages tab)
        </label>
      </div>
      <p className="hint">The {leaders} can always change the group. Messages from people in the group are signed with their name; replies go to the {leaders}.</p>
    </fieldset>
  );
}
