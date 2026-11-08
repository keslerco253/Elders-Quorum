// The January 2027 Temple & Family History Challenge (Villas Ward Elders Quorum and
// Relief Society), posted as a plan once by a migration. From the ward's invitation
// and its five weekly flyers. After it's posted, it's edited like any plan.

type Day = { date: string; day: string; q: string; talks: [string, string][]; invite: string };
type Week = { n: number; dates: string; start: string; theme: string; intro: string; days: Day[]; note?: string };

const WEEKS: Week[] = [
  {
    n: 1,
    dates: "Jan 1–6",
    start: "2027-01-01",
    theme: "Our Covenant Relationship with God",
    intro: "This week, we focus on the sacred covenants we make with Heavenly Father and Jesus Christ and how they draw us closer to Them.",
    days: [
      { date: "Jan 1", day: "Friday", q: "What is a covenant, and why does God make covenants with His children?", talks: [["Covenants and Responsibilities", "Dallin H. Oaks (Apr. 2024)"], ["Covenants", "Russell M. Nelson (Oct. 2011)"]], invite: "Ponder what a covenant means to you and how it shows Heavenly Father's love for His children." },
      { date: "Jan 2", day: "Saturday", q: "How do covenants bring us closer to Jesus Christ?", talks: [["Walking in Covenant Relationship with Christ", "Emily Belle Freeman (Oct. 2023)"], ["Why the Covenant Path", "D. Todd Christofferson (Apr. 2021)"]], invite: "Identify one way you can follow the Savior more closely through your covenants." },
      { date: "Jan 3", day: "Sunday", q: "How do our covenants bless us and those who come after us?", talks: [["The Infinite Power of God in Our Covenants", "Jeremiah J. Morgan (Oct. 2026)"], ["Covenant Belonging", "Gerrit W. Gong (Oct. 2019)"]], invite: "Consider the generations who may be blessed because of your faithfulness to your covenants." },
      { date: "Jan 4", day: "Monday", q: "What are the five covenants made in the temple?", talks: [["Personal Preparation for Temple Blessings", "Russell M. Nelson (Apr. 2001)"], ["Holy Temples, Sacred Covenants", "Silvia H. Allred (Oct. 2008)"]], invite: "Read or review the temple covenants and reflect on the promises the Lord makes to you there." },
      { date: "Jan 5", day: "Tuesday", q: "How do our covenants guide our everyday decisions?", talks: [["Live Up to Your Privileges", "Emily Belle Freeman (Oct. 2024)"], ["Covenants with God Strengthen, Protect, and Prepare Us for Eternal Glory", "Jean B. Bingham (Apr. 2022)"]], invite: "Look for one decision today where keeping your covenants can help you choose the right." },
      { date: "Jan 6", day: "Wednesday", q: "How have my covenants helped me feel closer to Heavenly Father?", talks: [["The Joy of a Covenant Relationship with God", "Thierry K. Mutombo (Apr. 2026)"], ["Covenant Confidence through Jesus Christ", "Ulisses Soares (Apr. 2024)"]], invite: "Take a few minutes to pray and express gratitude for the covenants you have made with Heavenly Father." },
    ],
  },
  {
    n: 2,
    dates: "Jan 7–12",
    start: "2027-01-07",
    theme: "The Blessings of Temple Worship",
    intro: "This week, we focus on the blessings, peace, and power of temple worship and how it helps us draw closer to Jesus Christ.",
    days: [
      { date: "Jan 7", day: "Thursday", q: "What does the temple teach me about Heavenly Father's plan?", talks: [["Be Still, and Know That I Am God", "David A. Bednar (Apr. 2024)"], ["Let This House Be Built unto My Name", "David A. Bednar (Apr. 2020)"]], invite: "Ponder what the temple teaches you about your purpose and divine potential." },
      { date: "Jan 8", day: "Friday", q: "How does temple worship bring peace and perspective?", talks: [["All Will Be Well Because of Temple Covenants", "Henry B. Eyring (Apr. 2024)"], ["Overcome the World and Find Rest", "Russell M. Nelson (Oct. 2022)"]], invite: "Look for ways to seek the Lord's peace today, as you would in His house." },
      { date: "Jan 9", day: "Saturday", q: "How does the temple strengthen my relationship with Jesus Christ?", talks: [["Accessing God's Power through Covenants", "Dale G. Renlund (Apr. 2023)"], ["The Power of Godliness", "Kent F. Richards (Apr. 2016)"]], invite: "Consider how your temple worship helps you feel the Savior's love more fully." },
      { date: "Jan 10", day: "Sunday", q: "Why is temple worship a source of strength in my life?", talks: [["Come to the Lord in His Holy House", "Gerrit W. Gong (Oct. 2026)"], ["The Temple and Your Spiritual Foundation", "Russell M. Nelson (Oct. 2021)"]], invite: "Think about a time the temple gave you strength, and consider how you can return." },
      { date: "Jan 11", day: "Monday", q: "How does the temple bless my family now and in the future?", talks: [["Enhancing Our Temple Experience", "L. Lionel Kendrick (Apr. 2001)"], ["I Love to See the Temple", "Henry B. Eyring (Apr. 2021)"]], invite: "Reflect on the eternal impact of temple covenants on your family for generations to come." },
      { date: "Jan 12", day: "Tuesday", q: "What can I do to prepare myself for meaningful temple worship?", talks: [["Blessings of the Temple", "Thomas S. Monson (Apr. 2015)"], ["Confidence in the Presence of God", "Russell M. Nelson (Apr. 2025)"]], invite: "Choose one step you can take today to be more ready to worship in the temple." },
    ],
  },
  {
    n: 3,
    dates: "Jan 13–18",
    start: "2027-01-13",
    theme: "Gathering Israel on Both Sides of the Veil",
    intro: "This week, we focus on our role in gathering Heavenly Father's children on both sides of the veil through temple and family history work.",
    days: [
      { date: "Jan 13", day: "Wednesday", q: "What does gathering Israel mean?", talks: [["With the Power of God in Great Glory", "David A. Bednar (Oct. 2021)"], ["The Gathering of Scattered Israel", "Russell M. Nelson (Oct. 2006)"]], invite: "Ponder what it means to help gather Israel and consider one way you can participate in the Lord's work." },
      { date: "Jan 14", day: "Thursday", q: "Why do we perform ordinances for those who have died?", talks: [["The Work of the Temple and Family History—One and the Same Work", "Benjamín De Hoyos (Apr. 2023)"], ["The Redemption of the Dead and the Testimony of Jesus", "D. Todd Christofferson (Oct. 2000)"]], invite: "Reflect on how temple ordinances reveal the Savior's love for all of Heavenly Father's children." },
      { date: "Jan 15", day: "Friday", q: "What is the Spirit of Elijah?", talks: [["The Hearts of the Children Shall Turn", "David A. Bednar (Oct. 2011)"], ["Generations Linked in Love", "Russell M. Nelson (Apr. 2010)"]], invite: "Think about an ancestor or family member and ask the Lord to deepen your love and connection to your family." },
      { date: "Jan 16", day: "Saturday", q: "How does temple service help accomplish the Lord's work?", talks: [["The Joy of Redeeming the Dead", "Richard G. Scott (Oct. 2012)"], ["A Voice of Gladness!", "Kevin R. Duncan (Apr. 2023)"]], invite: "Consider how serving in the temple can bless both you and those you serve." },
      { date: "Jan 17", day: "Sunday", q: "How can our covenants help gather Heavenly Father's family?", talks: [["Consider Your Ways, and from This Day Will the Lord Bless You", "Ciro Schmeil (Oct. 2026)"], ["Gathering the Family of God", "Henry B. Eyring (Apr. 2017)"]], invite: "Look for one way your covenant discipleship can help gather and bless God's family." },
      { date: "Jan 18", day: "Monday", q: "How can I personally participate in gathering Israel?", talks: [["Great Love for Our Father's Children", "Quentin L. Cook (Apr. 2019)"], ["The Hearts of the Children Shall Turn", "David A. Bednar (Oct. 2011)"]], invite: "Choose one specific family history or temple action you can take this week to help gather Israel." },
    ],
  },
  {
    n: 4,
    dates: "Jan 19–24",
    start: "2027-01-19",
    theme: "Family History and Connecting Generations",
    intro: "This week, we focus on how family history connects generations, strengthens our families, and draws us closer to Heavenly Father.",
    days: [
      { date: "Jan 19", day: "Tuesday", q: "Why do our ancestors' stories matter?", talks: [["We Each Have a Story", "Gerrit W. Gong (Apr. 2022)"], ["For the Sake of Your Posterity", "Carlos A. Godoy (Oct. 2023)"]], invite: "Think of one ancestor or family story that has shaped your life, and ponder why that story matters." },
      { date: "Jan 20", day: "Wednesday", q: "How can we discover more about our family history?", talks: [["Roots and Branches", "Quentin L. Cook (Apr. 2014)"], ["The Hearts of the Children Shall Turn", "David A. Bednar (Oct. 2011)"]], invite: "Explore the Family Tree app! Try \"Relatives Around Me,\" \"Map My Ancestors,\" or another activity to discover family connections." },
      { date: "Jan 21", day: "Thursday", q: "How does family history strengthen families?", talks: [["The Family-Centered Gospel of Jesus Christ", "Dallin H. Oaks (Oct. 2025)"], ["Hearts Bound Together", "Henry B. Eyring (Apr. 2005)"]], invite: "Consider how remembering and sharing family stories can strengthen your home and family relationships." },
      { date: "Jan 22", day: "Friday", q: "What blessings come from participating in family history?", talks: [["Family History and Temple Work: Sealing and Healing", "Dale G. Renlund (Apr. 2018)"], ["Happy and Forever", "Gerrit W. Gong (Oct. 2022)"]], invite: "Ponder the blessings the Lord may pour into your life as you participate in family history and temple work." },
      { date: "Jan 23", day: "Saturday", q: "How can we help children and grandchildren connect with their ancestors?", talks: [["Preserving the Voice of the Covenant People in the Rising Generation", "Jan E. Newman (Oct. 2023)"], ["Generations Linked in Love", "Russell M. Nelson (Apr. 2010)"]], invite: "Think of one way to help a child or grandchild feel connected to their ancestors." },
      { date: "Jan 24", day: "Sunday", q: "How can the covenants of our ancestors bless future generations?", talks: [["Divine Appointments", "Timothy L. Farnes (Oct. 2026)"], ["Gathering the Family of God", "Henry B. Eyring (Apr. 2017)"]], invite: "Reflect on the faith of those who came before you and how their covenant devotion can inspire future generations." },
    ],
  },
  {
    n: 5,
    dates: "Jan 25–31",
    start: "2027-01-25",
    theme: "Eternal Families and Salvation",
    intro: "This week, we focus on the eternal blessings of temple ordinances, sacred covenants, and the Savior's power to unite families forever.",
    days: [
      { date: "Jan 25", day: "Monday", q: "What does it mean for families to be eternal?", talks: [["The Family-Centered Gospel of Jesus Christ", "Dallin H. Oaks (Oct. 2025)"], ["Eternal Marriage Is an Eternal Journey", "Neil L. Andersen (Apr. 2026)"]], invite: "Ponder what it means to you that family relationships can continue eternally through Jesus Christ." },
      { date: "Jan 26", day: "Tuesday", q: "Why is sealing authority essential to God's plan?", talks: [["The Sealing Power", "D. Todd Christofferson (Oct. 2023)"], ["Rejoice in the Gift of Priesthood Keys", "Russell M. Nelson (Apr. 2024)"]], invite: "Reflect on how the sealing power reveals Heavenly Father's desire to bless His children forever." },
      { date: "Jan 27", day: "Wednesday", q: "How does Jesus Christ make eternal life possible?", talks: [["Keys, Covenants, and Easter", "Quentin L. Cook (Apr. 2026)"], ["Kingdoms of Glory", "Dallin H. Oaks (Oct. 2023)"]], invite: "Think about how the Savior makes every eternal blessing possible and offer Him your gratitude." },
      { date: "Jan 28", day: "Thursday", q: "How do temple ordinances unite generations?", talks: [["The Work of the Temple and Family History—One and the Same Work", "Benjamín De Hoyos (Apr. 2023)"], ["Family History and Temple Work: Sealing and Healing", "Dale G. Renlund (Apr. 2018)"]], invite: "Consider how temple ordinances connect your family across generations." },
      { date: "Jan 29", day: "Friday", q: "What does it mean to faithfully keep our temple covenants?", talks: [["Sealed by the Holy Spirit of Promise", "David A. Bednar (Oct. 2026)"], ["The Power of Covenants", "D. Todd Christofferson (Apr. 2009)"]], invite: "Ponder one way you can more faithfully honor the sacred covenants you have made." },
      { date: "Jan 30", day: "Saturday", q: "How can I make temple and family history work a lifelong priority?", talks: [["Come to the Lord in His Holy House", "Gerrit W. Gong (Oct. 2026)"], ["The Temple and Your Spiritual Foundation", "Russell M. Nelson (Oct. 2021)"]], invite: "Choose one habit that will help temple worship and family history remain part of your life." },
      { date: "Jan 31", day: "Sunday", q: "What have I learned, and how will I carry these blessings forward?", talks: [["Sealed by the Holy Spirit of Promise", "David A. Bednar (Oct. 2026)"], ["Think Celestial!", "Russell M. Nelson (Oct. 2023)"]], invite: "As you reflect on this month's journey, consider what you have learned and how you will continue this sacred work throughout your life." },
    ],
    note: "Jan. 31 is an area broadcast and personal study day.",
  },
];

/** A talk title, linked to a search for it in the Church's library. */
const talk = ([title, by]: [string, string]) => `- [*${title}*](https://www.churchofjesuschrist.org/search?query=${encodeURIComponent(title)}) — ${by}`;

function weekText(w: Week): string {
  const days = w.days.map((d) => [`#### ${d.date} · ${d.day}`, `**${d.q}**`, ...d.talks.map(talk), "", `> **A Personal Invitation:** ${d.invite}`].join("\n"));
  return [`### Week ${w.n}: ${w.theme}`, `*${w.intro}*`, ...days, ...(w.note ? [`*${w.note}*`] : [])].join("\n\n");
}

const INTRO = `**Temple & Family History Challenge | January 1–31, 2027**

**Dear Villas Ward Members,**

We would love to invite the ward to spend January drawing closer to the Savior through temple worship, family history, and learning about sacred covenants. We envision a friendly challenge between the Elders Quorum and Relief Society—fun enough to bring a smile, but centered on helping every member feel part of the Lord's work.`;

const TREES = `The Elders Quorum and Relief Society will each have a family tree poster. Members add one leaf for each qualifying activity:

- a temple visit,
- each General Conference talk they study from the January plan, or
- a separate family history activity or session.

Each activity has the same value. For example, one temple visit, seven talks, and one family history session would add nine leaves to the tree. Participation is voluntary, simple, and self-reported.`;

const TOGETHER = `Heavenly Father's Plan of Salvation is centered on Jesus Christ and provides a way for all of His children to return home to Him. In His wisdom, He has invited us to help accomplish this sacred work. Through temple service and family history, we help extend the blessings of temple ordinances and covenants to those who have gone before us. Every member has a part to play, and each person's contribution matters.

As we work together as a ward, we can better understand how the temple fits into Heavenly Father's plan and feel His love for each of His children. Our trees will represent our shared efforts to help gather His family—and the ways we grow closer to Him and to one another as we "Bring Heaven Closer."`;

const DAILY = `Each week has its own tab below (and its own flyer). Each day includes a question, two suggested General Conference talks, and a short "A Personal Invitation." Study one talk, both, or a relevant portion of either; you're not expected to complete everything. The goal is to increase our desire to be closer to our Heavenly Father and feel the joy that comes from that relationship—not to create another obligation.`;

const SUNDAYS = `Four conference messages are proposed for Sundays, subject to the usual Sunday schedule and Relief Society coordination:

- **Jan 3:** *The Infinite Power of God in Our Covenants* — Jeremiah J. Morgan
- **Jan 10:** *Come to the Lord in His Holy House* — Gerrit W. Gong
- **Jan 17:** *Consider Your Ways, and from This Day Will the Lord Bless You* — Ciro Schmeil
- **Jan 24:** *Divine Appointments* — Timothy L. Farnes

**January 31:** Area broadcast—no ward lesson. Members may study the day's two talks at home and reflect on their journey through January.`;

export const CHALLENGE_TITLE = "Bring Heaven Closer: Temple & Family History Challenge";

export function challengeBlocks() {
  return [
    { id: "intro-h", type: "heading", text: "Bring Heaven Closer", size: "xl" },
    { id: "intro", type: "text", text: INTRO },
    { id: "trees-h", type: "heading", text: "Two trees, one purpose" },
    { id: "trees", type: "text", text: TREES },
    { id: "together-h", type: "heading", text: "Together, we can Bring Heaven Closer" },
    { id: "together", type: "text", text: TOGETHER },
    { id: "daily-h", type: "heading", text: "A small invitation each day" },
    { id: "daily", type: "text", text: DAILY },
    { id: "weeks", type: "tabs", tabs: WEEKS.map((w) => ({ label: `Week ${w.n}`, sub: w.dates, start: w.start, text: weekText(w) })) },
    { id: "sundays-h", type: "heading", text: "October 2026 conference Sunday study connections" },
    { id: "sundays", type: "text", text: SUNDAYS },
    { id: "sign", type: "text", text: "*— Villas Ward Elders Quorum and Relief Society Presidencies*" },
  ];
}
