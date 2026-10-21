"use client";

import { useState } from "react";

/** What kind of Sunday it is, and the fields that go with it (a talk, an assigned topic, or a conference). */
export function LessonFields({ kind, date, url, title, speaker, cfm }: { kind: string; date: string; url: string; title: string; speaker: string; cfm: boolean }) {
  const [k, setK] = useState(kind);
  const topic = k === "topic";
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="kind">
            This Sunday is
          </label>
          <select id="kind" name="kind" value={k} onChange={(e) => setK(e.target.value)} className="input">
            <option value="talk">{cfm ? "A lesson" : "A lesson on a talk"}</option>
            <option value="topic">A lesson on an assigned topic</option>
            <option value="general_conference">General Conference (no lesson)</option>
            <option value="stake_conference">Stake Conference (no lesson)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">
            Date
          </label>
          <input id="date" name="date" type="date" defaultValue={date} className="input" />
        </div>
      </div>
      {topic ? (
        <>
          <div>
            <label className="label" htmlFor="title">
              Topic
            </label>
            <input id="title" name="title" defaultValue={title} className="input" placeholder="e.g. Ministering, Temple and family history" />
          </div>
          <div>
            <label className="label" htmlFor="speaker">
              Details <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea id="speaker" name="speaker" rows={2} defaultValue={speaker} className="input" placeholder="e.g. Assigned by the stake; focus on…" />
          </div>
          <div>
            <label className="label" htmlFor="url">
              Link <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="url" name="url" type="url" defaultValue={url} className="input" placeholder="https://…" />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="url">
              {cfm ? "Lesson link (Gospel Library)" : "Talk link (Gospel Library)"}
            </label>
            <input id="url" name="url" type="url" defaultValue={url} className="input" placeholder="https://www.churchofjesuschrist.org/study/general-conference/…" />
            {!cfm && <p className="hint">Leave the title and speaker blank to look them up from the link.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="title">
                {cfm ? "Reading" : "Talk title"}
              </label>
              <input id="title" name="title" defaultValue={title} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="speaker">
                {cfm ? "Lesson title" : "Speaker"}
              </label>
              <input id="speaker" name="speaker" defaultValue={speaker} className="input" />
            </div>
          </div>
        </>
      )}
    </>
  );
}
