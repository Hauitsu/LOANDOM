# Setup — Google Sheet as the database

No server, no domain, no billing. You need a Google account and five minutes.

---

## 1. Create the spreadsheet

1. Go to <https://sheets.new>.
2. Name it something like `LOANDOM`.
3. Leave it empty. The script creates the tabs.

> Already have a sheet with your own layout? You can keep it — the app uses its own tabs (`Raids`, `Players`, `Characters`, `Runs`, `Assignments`, `Ledger`, `Config`). Either copy your data into those tabs after step 3, or connect and push the app's data, then edit from there. Your old grid can stay untouched as a reference.

---

## 2. Attach the script

1. In the sheet: **Extensions → Apps Script**.
2. Delete the sample `myFunction` code.
3. Paste the whole of [`apps-script/Code.gs`](apps-script/Code.gs).
4. Save (`Ctrl+S`), name the project `LOANDOM`.
5. Open **Project Settings** (gear icon) → tick **Show “appsscript.json” manifest file in editor**.
6. Open `appsscript.json` and replace it with [`apps-script/appsscript.json`](apps-script/appsscript.json):

```json
{
  "timeZone": "Etc/UTC",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

---

## 3. Run setup once

1. In the editor, pick the function **`setup`** in the toolbar dropdown.
2. Click **Run**.
3. Approve the permission screen: *Review permissions → choose your account → Advanced → “Go to LOANDOM (unsafe)” → Allow*.

> “Unsafe” is Google's wording for any unpublished personal script. You are the author; nothing is shared with a third party.

`setup()` creates the seven tabs, headers, and the default catalog (four raids, four owners). If you had `Sheet1`, it removes it when empty.

You should see a toast: *“LOANDOM sheet is ready.”*

---

## 4. Optional: a PIN for writes

Reads are public (anyone with the URL can read). Writes require a PIN only if you set one.

1. In the Apps Script editor, add a temporary helper at the bottom of `Code.gs`:
   ```js
   function setMyPin() { setPin('4821'); }
   ```
2. Save, select `setMyPin` in the function dropdown, **Run**.
3. Delete the helper function and save again.
4. The same PIN goes in the app's **Settings → Google Sheet → PIN**.

To remove it: run `clearPin()` the same way.

> Treat the PIN as a lock, not encryption: it stops casual edits from the public URL, nothing more.

---

## 5. Deploy as a Web App

1. **Deploy → New deployment**.
2. Gear icon → **Web app**.
3. Fill in:
   - **Description:** `LOANDOM API`
   - **Execute as:** `Me (your@email)`
   - **Who has access:** `Anyone`
4. **Deploy** → copy the URL. It looks like:

```
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxx/exec
```

> Use the `/exec` URL, not `/dev`. `/dev` only works while you are signed in as the owner and returns HTML to everyone else.

**After editing the script later:** Deploy → **Manage deployments** → edit the existing one → **Version: New version** → Deploy. The URL stays the same.

---

## 6. Connect the app

1. Open your site (this repository is published at <https://hauitsu.github.io/LOANDOM/>).
2. **Settings → Google Sheet**.
3. Paste the `/exec` URL and the PIN (if you set one).
4. Click **Connect**.

What happens:

- The app calls `?op=health`, then loads the snapshot.
- If the sheet has no raids and no runs, the app **pushes the data currently on screen** into it (your demo/local tracker becomes the sheet).
- If the sheet already has data, the sheet wins and the browser switches to it.

---

## 7. Verify

Open the `/exec` URL with `?op=health` in a browser:

```json
{
  "ok": true,
  "app": "loandom",
  "revision": "3",
  "pinRequired": true,
  "tabs": ["Config", "Raids", "Players", "Characters", "Runs", "Assignments", "Ledger"]
}
```

In the app:

- Tick a run → the `Runs` tab's `cleared` cell flips within a second.
- Edit a character name in the sheet → the board updates within 20 s (or press **Sync now**).

---

## Editing the sheet by hand

The sheet stays a first-class editor:

- New rows are picked up automatically; missing `id` / `updatedAt` values are generated on the next read (“healing”).
- Columns are matched by header name. You can reorder them; don't rename them.
- `cleared` accepts `TRUE`, `true`, `1`, `yes`, `x`, `✓`.
- `week` must be the Wednesday date `YYYY-MM-DD` of the reset week (`2026-11-11`).
- Delete a character row and historical assignments keep the name (`characterId` becomes blank).
- Deleting a run row leaves its assignment rows orphaned; the app ignores them, but you can delete them too.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| “The endpoint returned an HTML page” | Deployment is not public, or you're signed into multiple Google accounts | Re-deploy with **Who has access: Anyone**; open the site in an incognito window; make sure the URL ends in `/exec` |
| `BAD_PIN` | PIN mismatch | Run `setPin('...')` again and paste the same value in Settings |
| `NO_PIN` | Sheet requires a PIN, app has none | Add the PIN in Settings |
| Board is empty after connecting | Tabs missing or wrong spreadsheet | Run `setup()` in Apps Script, then **Pull** |
| Changes don't show in the sheet | Queue stuck / offline | Settings → **Retry**, then **Sync now**; check the pill for the error |
| “The sheet is busy” | Two writers at once | Wait a second; the app retries automatically |
| Week has the wrong name/date | Reset day/hour differs | Settings → Week reset → change day/hour |
| Saved fine but a character has no id in the sheet | Row typed by hand | It heals on next load; press **Sync now** |

Apps Script quotas (free): 20,000 URL fetches/day, 90 min/day runtime. A personal tracker uses a tiny fraction.

---

## Security notes

- **Reads are public** to anyone who has the deployment URL and the revision-less snapshot endpoint. Don't put anything private in the sheet.
- The PIN only gates writes.
- The deployment URL is not a secret credential; it only reaches this one spreadsheet.
- The script can only touch the spreadsheet it is attached to.
- If you stop using it, delete the deployment (Deploy → Manage deployments → Archive) and the script keeps your data safe in the sheet.
