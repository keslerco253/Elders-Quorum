import Database from "better-sqlite3";
import { migrate } from "../../src/lib/db";
const d = new Database(process.argv[2]);
d.pragma("foreign_keys = ON");
migrate(d);
console.log("fk", d.pragma("foreign_keys", { simple: true }), d.prepare("PRAGMA foreign_key_check").all().length, d.pragma("integrity_check", { simple: true }));
for (const t of ["lessons", "comments", "sessions", "org_members"]) console.log((d.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(t) as any).sql.match(/REFERENCES [^,\n]*/g));
console.log(d.prepare("SELECT (SELECT COUNT(*) FROM members) m, (SELECT COUNT(*) FROM org_members) om, (SELECT COUNT(*) FROM sessions) s, (SELECT COUNT(*) FROM comments) c").get());
// deleting a member still cascades
d.prepare("DELETE FROM members WHERE id = (SELECT MAX(id) FROM members)").run();
console.log(d.prepare("SELECT (SELECT COUNT(*) FROM members) m, (SELECT COUNT(*) FROM org_members) om").get());
