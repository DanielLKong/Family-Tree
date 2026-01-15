/*
  Family Tree Data

  Each person has:
  - id: unique identifier
  - name: display name
  - parentIds: array of parent IDs (empty for root ancestors)
  - spouseId: ID of spouse (null if unmarried)
  - birthOrder: number for sorting siblings (lower = older)

  Optional fields (for profiles):
  - photo: base64 data URL of profile picture (resized to max 400px, circular crop)
  - photos: array of base64 data URLs for additional photos gallery
  - alsoCalled: array of nicknames/relationship names (e.g., ["Grandpa", "Pop Pop"])
  - birthDate: { year, month, day } - all optional, allows partial dates
  - deathDate: { year, month, day } - all optional, only shown if exists
  - location: string
  - maidenName: original surname if changed
  - occupation: string
  - education: string
  - hobbies: string
  - notes: string
*/

const familyData = {
  // Header info
  title: "Family Name",
  tagline: "",

  // The root generation (siblings at the top of the tree)
  rootPersonIds: [],

  // IDs of people whose branches are collapsed (persists with Local Storage later)
  collapsedIds: [],

  // All people in the family
  people: {}
};
