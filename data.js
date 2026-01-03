/*
  Family Tree Data

  Each person has:
  - id: unique identifier
  - name: display name
  - parentIds: array of parent IDs (empty for root ancestors)
  - spouseId: ID of spouse (null if unmarried)
  - birthOrder: number for sorting siblings (lower = older)

  Optional fields (for profiles):
  - maidenName: original surname if changed
  - birthYear, deathYear, photoUrl, notes
*/

const familyData = {
  // The root generation (siblings at the top of the tree)
  // Start empty - user will add their first family member
  rootPersonIds: [],

  // All people in the family
  people: {}
};
