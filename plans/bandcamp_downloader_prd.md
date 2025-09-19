# PRD: Bandcamp Downloader (v1)

## Objective  
Build a Chrome extension that allows a user to log into Bandcamp and bulk-download all *paid purchases* in MP3 format, with embedded metadata and artwork. This version focuses on getting the **auth + download loop** working end-to-end.

---

## Scope (v1)  
- **Authentication**  
  - Prompt user for login (credentials at app start).  
  - No credential storage.  
  - Reuse active Bandcamp session cookies where possible.  

- **Download**  
  - Fetch all *paid purchases* only.  
  - Default format: **MP3**.  
  - Sequential downloads (no concurrency).  
  - Resume downloads if interrupted.  
  - Always re-download (no deduping).  

- **Metadata & Organization**  
  - Include album art.  
  - Embed metadata into files (artist, album, track number, title).  
  - Organize as `Artist / Album / TrackNumber - Title.mp3`.  

- **Progress Dashboard**  
  - Show which album/track is downloading.  
  - Track total progress (e.g., 12 of 85 albums completed).  
  - Retry on error.  

---

## Non-Goals (v1)  
- Liner notes scraping.  
- Multiple format options.  
- Credential storage / auto-login.  
- Sync mode for new purchases.  
- Parallel downloads.  

---

## Technical Considerations  
- **No official API** → extension must parse user’s Bandcamp “purchases” page to list albums and extract download links.  
- **Chrome APIs**:  
  - `downloads` (to manage downloads)  
  - `cookies` (for session handling)  
- **Metadata embedding**: lightweight ID3 tagging in-extension or rely on tags from Bandcamp’s MP3s (they’re usually pre-tagged).  
- **UI**: basic extension popup or tab with progress bar + log.  

---

## Risks  
- **Bandcamp changes** to their DOM structure may break scraping.  
- Large libraries = long runtimes (but sequential flow keeps it simple).  
- Gray-zone legality → PRD assumes *personal archival use only*.  
