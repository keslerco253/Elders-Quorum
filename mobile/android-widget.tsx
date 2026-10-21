import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { FlexWidget, TextWidget, requestWidgetUpdate, type WidgetTaskHandler, type WidgetInfo } from "react-native-android-widget";

// The Android home-screen widget: this week's lesson, Come, Follow Me, what's coming
// up and new messages, like the iPhone widget (targets/widget). Android draws it from
// this JSX, in the background as well. It signs in with the widget key the app saves
// (from each signed-in page), and keeps the last answer to show when offline.

export const WIDGET_NAME = "WardWidget";
const KEY = "mwl_widget_key";
const CACHE = "mwl_widget_data";
const APP_URL: string = Constants.expoConfig?.extra?.appUrl ?? "https://mywardlink.net";

interface Item {
  title: string;
  when: string;
  path: string;
}

interface WardData {
  ward: string;
  lesson: { org: string; when: string; title: string; subtitle: string; path: string } | null;
  study: { reading: string; theme: string; path: string } | null;
  event: Item | null;
  events?: Item[];
  unread: number;
}

type State = { kind: "ready"; data: WardData } | { kind: "signedOut" } | { kind: "unavailable" };

type Colors = Record<"bg" | "text" | "muted" | "accent" | "badge" | "line", `#${string}`>;
const COLORS: { light: Colors; dark: Colors } = {
  light: { bg: "#ffffff", text: "#1f2933", muted: "#5f6b76", accent: "#1d5f99", badge: "#c0392b", line: "#e3e1dc" },
  dark: { bg: "#16202b", text: "#e6ebf0", muted: "#9aa7b4", accent: "#7fb0d8", badge: "#e5534b", line: "#26323f" },
};

/** Opens a page of the site in the app. */
const open = (path: string) => ({ clickAction: "OPEN_URI", clickActionData: { uri: `mywardlink://open?path=${encodeURIComponent(path)}` } });

/** Saves (or, signed out, clears) the widget's key and redraws the widget. */
export async function saveAndroidWidgetKey(key: string | null) {
  const before = await SecureStore.getItemAsync(KEY).catch(() => null);
  if (before === key) return;
  if (key) await SecureStore.setItemAsync(KEY, key).catch(() => {});
  else {
    await SecureStore.deleteItemAsync(KEY).catch(() => {});
    await SecureStore.deleteItemAsync(CACHE).catch(() => {});
  }
  await refreshAndroidWidget();
}

/** Redraws any of our widgets on the home screen with fresh information. */
export async function refreshAndroidWidget() {
  const state = await load();
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: (info) => render(state, info) }).catch(() => {});
}

async function load(): Promise<State> {
  const key = await SecureStore.getItemAsync(KEY).catch(() => null);
  if (!key) return { kind: "signedOut" };
  try {
    const res = await fetch(`${APP_URL}/api/widget`, { headers: { authorization: `Bearer ${key}` } });
    if (res.status === 401) return { kind: "signedOut" };
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as WardData;
    await SecureStore.setItemAsync(CACHE, JSON.stringify(data)).catch(() => {});
    return { kind: "ready", data };
  } catch {
    const cached = await SecureStore.getItemAsync(CACHE).catch(() => null);
    return cached ? { kind: "ready", data: JSON.parse(cached) as WardData } : { kind: "unavailable" };
  }
}

function Label({ text, c }: { text: string; c: Colors }) {
  return <TextWidget text={text.toUpperCase()} maxLines={1} truncate="END" style={{ fontSize: 11, fontWeight: "700", color: c.accent, letterSpacing: 0.04 }} />;
}

function Row({ label, title, detail, path, c, big }: { label: string; title: string; detail?: string; path: string; c: Colors; big?: boolean }) {
  return (
    <FlexWidget {...open(path)} style={{ width: "match_parent", flexDirection: "column", paddingVertical: 4 }}>
      <Label text={label} c={c} />
      <TextWidget text={title} maxLines={big ? 3 : 1} truncate="END" style={{ fontSize: big ? 16 : 14, fontWeight: "600", color: c.text }} />
      {detail ? <TextWidget text={detail} maxLines={1} truncate="END" style={{ fontSize: 12, color: c.muted }} /> : null}
    </FlexWidget>
  );
}

function Header({ data, c }: { data: WardData; c: Colors }) {
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingBottom: 4 }} {...open("/messages")}>
      <TextWidget text={data.ward} maxLines={1} truncate="END" style={{ fontSize: 12, fontWeight: "600", color: c.muted }} />
      <FlexWidget style={{ flex: 1 }} />
      {data.unread > 0 ? (
        <FlexWidget style={{ backgroundColor: c.badge, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
          <TextWidget text={String(Math.min(data.unread, 99))} style={{ fontSize: 11, fontWeight: "700", color: "#ffffff" }} />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

function Message({ title, detail, c }: { title: string; detail: string; c: Colors }) {
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ height: "match_parent", width: "match_parent", backgroundColor: c.bg, borderRadius: 18, padding: 14, flexDirection: "column", justifyContent: "center" }}>
      <TextWidget text={title} style={{ fontSize: 15, fontWeight: "600", color: c.text }} />
      <TextWidget text={detail} maxLines={3} style={{ fontSize: 12, color: c.muted }} />
    </FlexWidget>
  );
}

function WardWidget({ state, info, c }: { state: State; info?: WidgetInfo; c: Colors }) {
  if (state.kind === "signedOut") return <Message title="My Ward Link" detail="Open the app and sign in to see your ward here." c={c} />;
  if (state.kind === "unavailable") return <Message title="My Ward Link" detail="Couldn't load your ward right now. It will try again soon." c={c} />;
  const d = state.data;
  const height = info?.height ?? 180;
  const width = info?.width ?? 300;
  const events = d.events?.length ? d.events : d.event ? [d.event] : [];
  const rows: React.JSX.Element[] = [];
  if (d.lesson) rows.push(<Row key="l" label={`${d.lesson.when} · ${d.lesson.org}`} title={d.lesson.title} detail={d.lesson.subtitle} path={d.lesson.path} c={c} big={height < 150 || width < 200} />);
  if (d.study) rows.push(<Row key="s" label="Come, Follow Me" title={d.study.reading} detail={height >= 250 ? d.study.theme : undefined} path={d.study.path} c={c} />);
  events.slice(0, height >= 250 ? 3 : 1).forEach((e, i) => rows.push(<Row key={`e${i}`} label={i === 0 ? "Next up" : "Coming up"} title={e.title} detail={e.when} path={e.path} c={c} />));
  // Small: just the first thing; medium: about three; large: everything.
  const fits = height < 150 || width < 200 ? 1 : height < 250 ? 2 : 6;
  return (
    <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: c.bg, borderRadius: 18, padding: 12, flexDirection: "column" }} {...open("/")}>
      <Header data={d} c={c} />
      {rows.length ? rows.slice(0, fits) : <TextWidget text="Nothing coming up" style={{ fontSize: 13, color: c.muted }} />}
      {height >= 250 && d.unread > 0 ? (
        <TextWidget
          {...open("/messages")}
          text={d.unread === 1 ? "1 new message or notification" : `${d.unread} new messages and notifications`}
          style={{ fontSize: 12, fontWeight: "600", color: c.accent, paddingTop: 6 }}
        />
      ) : null}
    </FlexWidget>
  );
}

function render(state: State, info?: WidgetInfo) {
  return { light: <WardWidget state={state} info={info} c={COLORS.light} />, dark: <WardWidget state={state} info={info} c={COLORS.dark} /> };
}

/** Android asks for the widget when it's added, every 30 minutes, and when resized. */
export const widgetTaskHandler: WidgetTaskHandler = async (props) => {
  if (props.widgetAction === "WIDGET_DELETED" || props.widgetAction === "WIDGET_CLICK") return;
  props.renderWidget(render(await load(), props.widgetInfo));
};
