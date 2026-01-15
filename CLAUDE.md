# Family Tree Project - CLAUDE.md

## Section 1: User Profile

**Background:** Complete beginner, no prior coding experience. Not technical but intellectually curious about how things work.

**Learning Goals:**
- Understand concepts at a high level (the "what" and "why")
- Not aiming to become a coder, but wants to understand architecture and decisions
- Build transferable understanding of how software projects come together

**Learning Style:**
- "Vibe coding" approach — I build, they observe, I summarize when done
- Questions come naturally after seeing results, not during building
- Prefers seeing things work first, then understanding why

**Communication Preference:**
- Check in after each visual change (anything they can see/test)
- Iterate in small parts, start small and build up
- Summaries after completing work, not play-by-play during

**Constraints:** No timeline pressure. Quality and understanding over speed.

---

## Section 2: Communication & Teaching Style

**After completing work:**
- Give a high-level summary of what was built
- Explain how it fits into the bigger picture
- Use analogies and plain language
- Invite questions: "Want me to explain any part of that?"

**Concepts to explain:**
- Architecture decisions and why certain approaches were chosen
- How different pieces connect together
- Trade-offs when they affect user experience

**Keep automatic:**
- All code implementation details
- Technical setup and configuration
- Syntax and programming specifics
- Bug fixes and debugging

---

## Section 3: Project Overview

**What we're building:** A Family Tree website where users can visually map out their family in a flowchart/org-chart style.

**Inspiration:** Slack and Workday org charts — clean, clickable, hierarchical.

**Target users:**
- Phase 1: Personal use (Daniel's family)
- Phase 2: Other families (accounts, sharing, collaboration)

**Success criteria:**
- Can navigate through extended family visually
- Can add people and relationships (child, parent, spouse)
- Can click on someone to see their profile
- Clean, zoomable interface with generations aligned horizontally

---

## Section 4: Feature Roadmap

### Completed
- [x] Visual tree with horizontal generations
- [x] Warm, personal aesthetic (not corporate)
- [x] Add/Edit/Delete people, spouses, children, siblings
- [x] Drag-and-drop birth order reordering
- [x] Collapsible branches with expand/collapse all
- [x] Zoomable interface (default 100% = comfortable view)
- [x] Profile side panel (click name to open, shows family connections)
- [x] Profile content fields (photo, basics, family links, about section)
- [x] LinkedIn-style photo modal with crop/zoom
- [x] Photos gallery with drag & drop, paste, lightbox viewer
- [x] Profile navigation (click family member → opens their profile with back button)
- [x] Editable header (click to edit family name and tagline)
- [x] Local Storage - Auto-save tree data to browser
- [x] Clickable spouse names on cards (opens their profile)
- [x] Nickname display on cards with cycling arrows
- [x] Nicknames toggle button in control panel
- [x] Centered card layout (avatar on top, names below)

### Phase 2 - Web (User Accounts & Cloud)

**Stack:** Supabase (auth, database, photo storage) + Vercel (hosting)

**Why Supabase over Firebase:**
- PostgreSQL database (relational, perfect for family trees)
- Predictable pricing ($25/mo Pro vs Firebase pay-per-read)
- Open source, no vendor lock-in
- Generous free tier (50K auth users, 500MB database, 1GB photos)

**Guest vs. Account Model:**
| Feature | Guest (No Account) | With Account |
|---------|-------------------|--------------|
| Create/edit trees | ✅ Yes | ✅ Yes |
| Multiple trees | ✅ Yes | ✅ Yes |
| Data stored in | localStorage | Cloud (Supabase) |
| Sync across devices | ❌ No | ✅ Yes |
| Share with family | ❌ No | ✅ Yes |
| Invite collaborators | ❌ No | ✅ Yes |

**Implementation Phases:**
- [ ] **Phase A:** Deploy to Vercel (get app hosted)
- [ ] **Phase B:** Add Supabase Auth (email/password + magic link login)
- [ ] **Phase C:** Cloud data storage (migrate from localStorage)
- [ ] **Phase D:** Photo storage (replace base64 with cloud URLs)
- [ ] **Phase E:** Sharing (invite family, permissions, view/edit access)

**User Decisions:**
- Login: Both email/password AND magic link options
- Email verification: Start immediately, verify later
- Data migration: Import localStorage data on signup

**Hosting:**
- Platform: Vercel (free tier)
- Domain: Free Vercel URL initially (can add custom domain later)

### Future (Phase 2) - Mobile App

**Concept: Family Reunion Companion**

The web version is the "power tool" for building and editing the tree. The mobile app is a "consumption" tool for using it at family events.

**Quick Reference Mode:**
- All branches collapsed by default (like Slack's org chart)
- Simple card grid - tap to see full profile
- Big photo, key info at a glance
- Swipe between people in a generation
- Search/filter by name or relationship

**Flashcard Mode (for learning family):**
- **Photo → Name**: See face, guess who it is
- **Name → Photo**: See name, picture their face
- **Profile Quiz**: "What does Uncle Mike do for work?"
- Track progress, focus on people you don't know well
- Great for kids or new family members (spouses joining the family)

**Other mobile-friendly features:**
- "Who's here?" - check off who's at the reunion
- Quick add photo - snap a pic, tag a person
- Relationship path - "How am I related to Noah?"

---

## Section 5: Visual Design Direction

**Style:** Warm and personal
- Soft, inviting colors (not harsh corporate blues)
- Rounded edges, gentle shadows
- Feels like a family keepsake, not a business tool
- Clean but not sterile

**Interaction model:**
- Zoom in/out to navigate generations
- Click on person to see details
- Clear visual hierarchy (generations on horizontal lines)

**Design Tool:**
Always use the `frontend-design` skill (plugin:frontend-design@claude-plugins-official) when creating or updating UI components. This ensures:
- Distinctive, production-grade design quality
- Avoids generic AI aesthetics
- Professional polish and thoughtful details

---

## Section 6: Profile Panel Design

**Inspiration:** Slack profile sidebar - clean, scannable, personal.

### Structure

**Header**
- Profile photo (initials in colored circle if no photo)
- Full name (large, prominent)

**Basics Section** (always visible, show blank if empty)
- Also called: `___`
- Born: `___`
- Died: `___` *(only shows if date entered)*
- Age: `___` *(calculated, shows if birth date exists)*
- Location: `___`

**Family Section** (hide rows with no data)
- Parents *(clickable links, hide if unknown)*
- Spouse *(clickable)*
- Siblings *(clickable)*
- Children *(clickable)*

**About Section** (only show filled fields)
- Maiden name
- Occupation
- Education
- Hobbies
- Notes *(single text area)*
- *faded hint:* "add occupation, education, hobbies..."

### "Also Called" Field

This field captures relationship-based names and nicknames:
- Shortened names: Robert → "Bob"
- Relationship names: "Grandpa", "Pop Pop", "Uncle Bobby"
- Terms of endearment: "Big Mike", "Auntie M"

**Future use:** Enables personalized views where each user sees their own name for a person (e.g., "Grandpa" vs "Uncle Robert").

### Flexible Date Picker

Three-column picker allowing partial dates:
- Year (1800–2025, with `--` option)
- Month (Jan–Dec, with `--` option)
- Day (1–31, with `--` option)

**Display logic:**
- Year only → `1952`
- Year + Month → `3/1952`
- Full date → `3/15/1952`
- Nothing selected → *(blank)*

**Age calculation:**
- Living person → current age from today
- Deceased → age at death
- Only year known → approximate (e.g., `~73`)
- No birth date → don't show age

---

## Section 7: Technical Decisions Log

*Will be updated as we build. Documents the "why" behind major choices.*

---

## Section 8: Glossary of Concepts

*Terms and concepts explained in plain language. Will grow as we encounter new ideas.*

---

## Section 9: Questions & Curiosities

*Space for questions that come up during building.*

---

## Section 10: Action Items for Next Session

### Immediate Next Steps
*Phase 1 complete! Next steps are Phase 2 features.*

### Testing Checklist (if needed)
- [ ] Profile panel features (also called, dates, locations, about fields)
- [ ] Photo modal (upload, crop, zoom, delete)
- [ ] Photos gallery (multiple upload, drag & drop, paste, lightbox)
- [ ] Editable header (click to edit title/tagline)
- [ ] Nickname cycling on cards
- [ ] Nicknames toggle button

