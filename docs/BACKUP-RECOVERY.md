# Private business backups & recovery

The GitHub repo is public, so confidential records live only in the git-ignored `private/` folder (plus original artwork in `assets/brand/`). This guide keeps them safe.

## What gets backed up

| Record | Where it lives |
| --- | --- |
| Supplier info & quotes | `private/suppliers/` |
| Product costs, pricing sheets | `private/costs/`, `private/catalog.csv`, `private/catalog-internal.json` |
| Purchase invoices | `private/invoices/` |
| CPCs, lab reports, tracking-label photos | `private/compliance/` |
| Packaging & shipping records | `private/shipping/` |
| Approved policies, registrations, legal advice | `private/policies/` |
| Original brand assets | `assets/brand/`, `private/brand-originals/` |
| Internal launch checklist | `private/LAUNCH-CHECKLIST.md` |

The website code itself is already backed up on GitHub (`test23780460/FunkSquish`).

> Note: this project folder is inside OneDrive, so `private/` is already synced (unencrypted) to your **private** OneDrive account. That protects against a dead laptop, but the encrypted backup below also protects against a compromised Microsoft account and gives you an offline copy.

## The plan (3-2-1)

- **3 copies:** your laptop + 2 encrypted backups.
- **2 places:** a cloud folder you approve (recommended: **OneDrive Personal Vault**) and a **USB drive** kept at home.
- **1 offline:** the USB drive, unplugged when not in use.
- **When:** after any new invoice, certificate, or supplier document — and at least monthly.

Backups are encrypted with **AES-256** (GnuPG, included with Git for Windows). The passphrase is typed by you at the prompt, never stored in a file. **Save it in a password manager** (e.g. Google Password Manager or 1Password). Without it, nobody can open the backup — including you.

## Make a backup

Open **Git Bash** in the project folder and run (change the destination):

```bash
bash scripts/backup-private.sh "/c/Users/ptrav/OneDrive/FunkSquish Backups"
```

For a USB drive showing as `E:`:

```bash
bash scripts/backup-private.sh "/e/FunkSquish Backups"
```

You'll get `funksquish-private-<date>.tar.gz.gpg` plus a `.sha256` checksum file. The script refuses to write inside the website project, and it never moves or deletes your originals.

Check the backup opens (lists files, restores nothing):

```bash
bash scripts/restore-private.sh verify "/e/FunkSquish Backups/funksquish-private-<date>.tar.gz.gpg"
```

To move the file into **OneDrive Personal Vault**: open OneDrive in File Explorer → Personal Vault (unlock it) → drag the `.gpg` and `.sha256` files in.

## Recover after a computer failure

1. On the new computer, install **Git for Windows** (includes Git Bash and gpg) and **Node.js 20.9+**.
2. Get the website code back:

```bash
git clone https://github.com/test23780460/FunkSquish.git
```

```bash
cd FunkSquish && npm install
```

3. Copy your newest `.gpg` backup (and its `.sha256`) from OneDrive Personal Vault or the USB drive to the computer.
4. Restore into an empty folder (it checks the checksum, then asks for your passphrase):

```bash
bash scripts/restore-private.sh restore "/c/Users/you/Downloads/funksquish-private-<date>.tar.gz.gpg" "/c/Users/you/Downloads/restored"
```

5. Copy `restored/private/` into the project folder as `private/`, and `restored/assets/brand/` into `assets/brand/` if missing.
6. Check: `npm run catalog:check` should run, and `git status` should **not** list anything in `private/` (it's ignored).
7. Website secrets (Brevo API key, etc.) are **not** in the backup — they live in Netlify → Environment variables and in each provider's dashboard. You can always create new keys there.

## Don'ts

- Don't put backups, `.gpg` files, or `private/` contents in `public/`, `src/`, GitHub, or any shared/public link.
- Don't email the passphrase or store it next to the backup.
- Don't delete the oldest backup until a newer one has passed `verify`.
