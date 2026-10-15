"use client";

import { useEffect } from "react";

/**
 * Every drop-down with a longer list (people, time zones, groups...) becomes a box
 * you can type in to filter the list, as well as pick from it. The real <select>
 * stays in the page (hidden) so forms and the app's own code work as before.
 * Short lists stay ordinary drop-downs. A <select data-native> is left alone;
 * <select data-search> always gets the search box.
 */
const MIN_OPTIONS = 8;

export function SearchableSelects() {
  useEffect(() => {
    const done = new WeakSet<HTMLSelectElement>();
    const scan = () => {
      document.querySelectorAll<HTMLSelectElement>("select:not([multiple]):not([data-native])").forEach((sel) => {
        if (done.has(sel)) return;
        const count = Array.from(sel.options).filter((o) => o.value !== "").length;
        if (count < MIN_OPTIONS && !sel.hasAttribute("data-search")) return;
        done.add(sel);
        enhance(sel);
      });
    };
    scan();
    const watch = new MutationObserver(() => scan());
    watch.observe(document.body, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, []);
  return null;
}

let uid = 0;

function enhance(sel: HTMLSelectElement) {
  const id = `ss-${++uid}`;
  // The search box goes right after the drop-down, which stays where the page put it
  // (React keeps track of it), just hidden.
  const wrap = document.createElement("div");
  wrap.className = `ss-wrap${/\bw-auto\b/.test(sel.className) ? " ss-inline" : ""}`;
  sel.after(wrap);
  sel.classList.add("ss-native");
  sel.tabIndex = -1;
  sel.setAttribute("aria-hidden", "true");

  const input = document.createElement("input");
  input.type = "text";
  input.className = `${sel.className.replace("ss-native", "")} ss-input w-full`;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", `${id}-list`);
  input.autocomplete = "off";
  input.spellcheck = false;
  // A <label for> pointing at the select now points at the search box.
  if (sel.id) {
    input.id = `${sel.id}-search`;
    document.querySelectorAll<HTMLLabelElement>(`label[for="${CSS.escape(sel.id)}"]`).forEach((l) => (l.htmlFor = input.id));
  }
  if (sel.getAttribute("aria-label")) input.setAttribute("aria-label", sel.getAttribute("aria-label")!);
  wrap.appendChild(input);

  const list = document.createElement("ul");
  list.id = `${id}-list`;
  list.className = "ss-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  wrap.appendChild(list);

  let open = false;
  let active = -1;
  let shown: HTMLOptionElement[] = [];

  const selectedText = () => {
    const o = sel.options[sel.selectedIndex];
    return o && o.value !== "" ? o.text : "";
  };
  const placeholder = () => {
    const empty = Array.from(sel.options).find((o) => o.value === "");
    return empty?.text || "Type to search…";
  };
  const sync = () => {
    if (document.activeElement === input) return;
    input.value = selectedText();
    input.placeholder = placeholder();
    input.disabled = sel.disabled;
  };

  const render = (q: string) => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    list.innerHTML = "";
    shown = [];
    let group: string | null = null;
    for (const o of Array.from(sel.options)) {
      if (o.disabled && o.value === "") continue;
      const text = o.text.toLowerCase();
      if (words.length && !words.every((w) => text.includes(w))) continue;
      const g = o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : null;
      if (g && g !== group) {
        const h = document.createElement("li");
        h.className = "ss-group";
        h.textContent = g;
        h.setAttribute("role", "presentation");
        list.appendChild(h);
      }
      group = g;
      const li = document.createElement("li");
      li.id = `${id}-o${shown.length}`;
      li.className = "ss-option";
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(o.selected));
      li.textContent = o.text || "—";
      if (o.disabled) li.setAttribute("aria-disabled", "true");
      const index = shown.length;
      li.addEventListener("mousedown", (e) => e.preventDefault());
      li.addEventListener("click", () => choose(index));
      list.appendChild(li);
      shown.push(o);
    }
    if (!shown.length) {
      const li = document.createElement("li");
      li.className = "ss-empty";
      li.textContent = "No matches";
      list.appendChild(li);
    }
    active = Math.max(0, shown.findIndex((o) => o.selected));
    highlight();
  };
  const highlight = () => {
    list.querySelectorAll(".ss-option").forEach((li, i) => li.classList.toggle("ss-active", i === active));
    const li = list.querySelector<HTMLElement>(`#${id}-o${active}`);
    if (li) {
      input.setAttribute("aria-activedescendant", li.id);
      li.scrollIntoView({ block: "nearest" });
    }
  };
  const show = () => {
    if (open || sel.disabled) return;
    open = true;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    render("");
  };
  const hide = () => {
    open = false;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };
  const choose = (i: number) => {
    const o = shown[i];
    if (!o || o.disabled) return;
    if (sel.value !== o.value) {
      sel.value = o.value;
      // Tell the page (and React) the choice changed, as a real drop-down would.
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    input.value = o.text;
    hide();
  };

  input.addEventListener("focus", () => {
    input.select();
    show();
  });
  input.addEventListener("click", show);
  input.addEventListener("input", () => {
    if (!open) show();
    render(input.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      active = Math.min(shown.length - 1, Math.max(0, active + (e.key === "ArrowDown" ? 1 : -1)));
      highlight();
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault();
        choose(active);
      }
    } else if (e.key === "Escape") {
      hide();
      input.value = selectedText();
    } else if (e.key === "Tab" && open && input.value && shown.length === 1) {
      choose(0);
    }
  });
  input.addEventListener("blur", () => {
    hide();
    input.value = selectedText();
  });
  // Keep the box showing the choice if the page changes it (or its list).
  sel.addEventListener("change", sync);
  new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true });
  const timer = window.setInterval(() => {
    if (!sel.isConnected) {
      window.clearInterval(timer);
      wrap.remove();
      return;
    }
    if (!open) sync();
  }, 400);
  sync();
}
