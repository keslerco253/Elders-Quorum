import Link from "next/link";
import { Disclaimer, DISCLAIMER_TEXT } from "@/components/disclaimer";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";

// The public home page: what the app is, for people who aren't signed in
// (shown at "/" for them). Uses the app's own colors and icon only.

export const metadata: Metadata = {
  title: { absolute: "My Ward Link · Your ward, organized in one place" },
  description:
    "A free, volunteer-run app for wards and their organizations: lessons and teachers, the ward calendar, service sign-ups, messages, assignments, presidency meetings, plans and visits. Not an official website of The Church of Jesus Christ of Latter-day Saints.",
};

const DISCLAIMER = DISCLAIMER_TEXT;

const ICONS: Record<string, string> = {
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0v16M8 7h7",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  chat: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  people: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5m0-5c1-.6 2-1 3-1 3 0 5 2 5 5",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
  check: "M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11",
  clipboard: "M9 4h6v3H9zM7 5H5v16h14V5h-2M8 12h8M8 16h5",
  plan: "M4 4h16v16H4zM4 9h16M9 9v11",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01",
};

function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

const FEATURES = [
  { icon: "book", title: "Lessons and teachers", text: "Post the schedule once. Teachers get reminders, confirm with one tap, and can share notes before Sunday. Members read and comment ahead of time." },
  { icon: "calendar", title: "One ward calendar", text: "Every organization's activities in one place, filtered when you want. Add events to your phone's calendar, or subscribe and stay up to date." },
  { icon: "people", title: "Every organization", text: "Elders quorum, Relief Society, Primary, youth, and more. Each has its own leaders, lessons and messages, and members choose the ones they belong to." },
  { icon: "chat", title: "Messages and replies", text: "Leaders send announcements by notification, text or email. Members can reply, or write privately to one leader. Or turn replies off and just send information out." },
  { icon: "check", title: "Assignments", text: "Ask someone to take an assignment; they accept or say they can't. Due dates, reminders, attachments and progress notes, all in one list." },
  { icon: "clipboard", title: "Presidency meetings", text: "The agenda builds itself from messages and notes. Take notes, track who was there, start a Zoom call, and see who's conducting each Sunday." },
  { icon: "list", title: "Service", text: "Meals, moves, service projects and rides, with spots that fill as people sign up. Share a link or QR code so friends can sign up too." },
  { icon: "home", title: "Visits", text: "Members can ask for a visit. Leaders invite, plan who's going, and everyone gets a reminder before it." },
  { icon: "plan", title: "Plans and challenges", text: "Plan pages with pictures and PDFs for ward activities, and friendly challenges between organizations with team totals." },
  { icon: "bell", title: "Reach people their way", text: "Notifications on the phone, plus text or email. Each person chooses, and leaders see who opened a message and who couldn't be reached." },
  { icon: "help", title: "Help built in", text: "Ask a question in your own words, like \"How do I stop getting texts?\", and get a plain answer from the app's own guide. Leaders have their own guide too." },
  { icon: "shield", title: "Private by design", text: "Only a name and a phone number or email. No addresses, no ads, nothing sold. Old information deletes itself; delete your account any time." },
];

const STEPS = [
  { title: "Start your ward", text: "A member of the bishopric (or someone they ask) starts the ward in a minute. After a quick check that it's real (usually within a day), you get its join code." },
  { title: "Set up organizations", text: "Your ward comes with Elders Quorum, Relief Society, Young Men, Young Women, Primary and Sunday School. Turn off any you don't use and choose who leads each." },
  { title: "Share the join code", text: "Show the QR code in a meeting or send the join link. Members join with their phone or email, choose their organizations, and add the app to their home screen." },
];

const FAQ = [
  { q: "Is this an official Church app?", a: DISCLAIMER + " For official tools, use Gospel Library and Member Tools." },
  { q: "What does it cost?", a: "Nothing. It's free for wards and members, and there are no ads." },
  { q: "Do I need to download anything?", a: "No. It opens in your phone's browser. Add it to your home screen and it works like an app, with notifications." },
  { q: "Who can see my information?", a: "Your ward's leaders can see the name and phone number or email you give. Other members see only your name on things you post or sign up for." },
  { q: "How do I get help using it?", a: "In the app, open More → Help and ask a question in your own words, like \"How do I stop getting texts?\". Leaders have their own Leader guide under Admin." },
  { q: "Can each organization choose what it uses?", a: "Yes. Each presidency turns on just what it needs (lessons, service, visits, assignments, plans, challenges and more) and sets when its reminders go out." },
];

/** A small picture of the app's home screen, drawn with the app's own styles. */
function PhonePreview() {
  return (
    <div className="mx-auto w-[280px] rounded-[2.5rem] border-[10px] border-[#0e151d] bg-bg text-left text-text shadow-2xl" aria-hidden>
      <div className="overflow-hidden rounded-[1.8rem]">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 pt-6 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-7 w-7 rounded-lg" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Elders Quorum</div>
            <div className="text-[10px] text-muted">Maple Ward</div>
          </div>
        </div>
        <div className="space-y-3 p-3">
          <div className="text-base font-bold">Good morning, Sam</div>
          <div className="text-[11px] font-semibold text-muted uppercase">This Sunday</div>
          <div className="flex gap-3 rounded-xl border border-border bg-surface p-3">
            <div className="flex h-12 w-11 flex-col items-center justify-center rounded-lg bg-primary text-primary-text">
              <span className="text-[9px] font-semibold">OCT</span>
              <span className="text-base leading-none font-bold">18</span>
            </div>
            <div className="min-w-0 text-xs">
              <div className="font-semibold">Faith to Move Forward</div>
              <div className="text-muted">Teacher: Brother Lee</div>
              <div className="mt-1 font-semibold text-accent">Study and share ›</div>
            </div>
          </div>
          <div className="text-[11px] font-semibold text-muted uppercase">Coming up</div>
          <div className="divide-y divide-border rounded-xl border border-border bg-surface text-xs">
            <div className="px-3 py-2">
              <div className="font-medium">Ward temple night</div>
              <div className="text-muted">Fri 7:00 PM · Maple Ward</div>
            </div>
            <div className="px-3 py-2">
              <div className="font-medium">Service project</div>
              <div className="text-muted">Sat 9:00 AM · Elders Quorum</div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent">
            <span>
              <span className="block font-semibold">Move-in help</span>3 spots open
            </span>
            <span>›</span>
          </div>
        </div>
        <div className="grid grid-cols-5 border-t border-border bg-surface py-2 text-[9px] text-muted">
          {[
            ["home", "Home"],
            ["book", "Lessons"],
            ["calendar", "Calendar"],
            ["plan", "Plans"],
            ["more", "More"],
          ].map(([icon, label], i) => (
            <div key={label} className={`flex flex-col items-center gap-0.5 ${i === 0 ? "text-accent" : ""}`}>
              <Icon name={icon} className="h-4 w-4" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function AboutPage() {
  const signedIn = !!(await getUser());
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-text">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            My Ward Link
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <Link href="/" className="btn-primary btn-sm">
                Open the app
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-secondary btn-sm">
                  Sign in
                </Link>
                <Link href="/join" className="btn-primary btn-sm hidden sm:inline-flex">
                  Join your ward
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-[#1d3a5f] text-white">
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-14 md:grid-cols-[1fr_auto] md:py-20">
            <div>
              <p className="mb-3 text-sm font-semibold tracking-wide text-[#e9c46a] uppercase">For wards and their organizations</p>
              <h1 className="text-4xl leading-tight font-bold sm:text-5xl">Your ward, organized in one place.</h1>
              <p className="mt-4 max-w-xl text-lg opacity-90">
                Lessons and teachers, the ward calendar, service sign-ups, messages, assignments and visits, for every organization in your ward. Free, private, and made by
                volunteers who serve in wards too.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/join" className="btn min-h-12 bg-white px-6 text-base text-[#1d3a5f] hover:bg-[#e3eef6]">
                  Join your ward
                </Link>
                <Link href="/start" className="btn min-h-12 border border-white/50 px-6 text-base text-white hover:bg-white/10">
                  Start a ward
                </Link>
              </div>
              <p className="mt-6 max-w-xl text-xs opacity-80">Not an official website of The Church of Jesus Christ of Latter-day Saints.</p>
            </div>
            <PhonePreview />
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Everything your ward plans, in one app</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted">Less chasing texts and sign-up sheets. More time ministering.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon name={f.icon} />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Set up in an evening</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-text">{i + 1}</span>
                  <div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10 text-center">
              <Link href="/start" className="btn-primary min-h-12 px-6 text-base">
                Start your ward
              </Link>
              <p className="mt-3 text-sm text-muted">
                Your ward is already here?{" "}
                <Link href="/join" className="text-accent underline">
                  Join with its code
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Questions</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="card group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-6 w-6 rounded-md" />
            My Ward Link
          </div>
          <p className="max-w-3xl rounded-lg bg-surface-2 px-4 py-3 text-muted">{DISCLAIMER}</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-muted">
            <Link href="/privacy" className="hover:text-text">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-text">
              Terms
            </Link>
            <Link href="/login" className="hover:text-text">
              Sign in
            </Link>
            <Link href="/join" className="hover:text-text">
              Join your ward
            </Link>
            <Link href="/start" className="hover:text-text">
              Start a ward
            </Link>
          </nav>
          <Disclaimer className="text-left" />
        </div>
      </footer>
    </div>
  );
}
