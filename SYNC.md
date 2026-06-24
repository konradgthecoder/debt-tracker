# Cloud sync setup

The tracker can auto-sync your data across devices using a **private GitHub repo**
as storage. Your data is written via the GitHub API with a token you create once.
The token is stored only in each device's `localStorage` — never in the repo, never public.

## One-time setup

### 1. Data repo
A private repo already exists: **`konradgthecoder/debt-tracker-data`**.
(If you ever need to recreate it: `gh repo create <owner>/debt-tracker-data --private`.)

### 2. Create a fine-grained token (scoped to just that repo)
1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Repository access** → *Only select repositories* → pick `debt-tracker-data`
3. **Permissions → Repository permissions → Contents → Read and write**
4. Set an expiry you're comfortable with (e.g. 1 year), generate, copy the token
   (`github_pat_…`).

> Fine-grained + single-repo + Contents-only = minimal blast radius. If the token
> leaks, the worst case is read/write to this one private data file — nothing else.

### 3. Connect each device
1. Open the tracker → **⇅ Sync / backup**
2. Under **☁ Cloud sync**, paste the token; repo is prefilled (`konradgthecoder/debt-tracker-data`)
3. **Connect sync**
   - First device with data → it uploads your current data.
   - A device with no data → it pulls whatever's in the cloud.
   - If both have data, it asks which to keep.

Repeat on your phone with the **same token**.

## How it behaves
- **Edits auto-save** to the cloud ~1.5s after you change something.
- **Opening the app** (or returning to the tab) pulls the latest.
- **Conflicts** use last-write-wins by timestamp; if another device wrote more
  recently, the newer version wins. Avoid editing the same field on two devices
  at the exact same time.
- The ribbon shows status: `☁ synced ✓` / `saving…` / `offline` / `auth failed`.

## Tokens & rotation
- Stored per device in `localStorage` under `gh_sync_token`.
- To revoke access on a lost device: delete the token in GitHub settings and
  generate a new one for your other devices.
- **Disconnect** in the modal removes the token from that device only.
