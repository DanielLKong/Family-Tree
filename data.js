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
  // The starting person for the tree (top of hierarchy)
  rootPersonId: "robert-1",

  // All people in the family
  people: {
    // Generation 1 - Grandparents
    "robert-1": {
      id: "robert-1",
      name: "Robert Johnson",
      parentIds: [],
      spouseId: "eleanor-1"
    },
    "eleanor-1": {
      id: "eleanor-1",
      name: "Eleanor Johnson",
      parentIds: [],
      spouseId: "robert-1"
    },

    // Generation 2 - Parents (Robert & Eleanor's children)
    "michael-1": {
      id: "michael-1",
      name: "Michael Johnson",
      parentIds: ["robert-1", "eleanor-1"],
      spouseId: "sarah-1",
      birthOrder: 1
    },
    "sarah-1": {
      id: "sarah-1",
      name: "Sarah Johnson",
      parentIds: [],
      spouseId: "michael-1"
    },
    "david-1": {
      id: "david-1",
      name: "David Johnson",
      parentIds: ["robert-1", "eleanor-1"],
      spouseId: null,
      birthOrder: 2
    },
    "jennifer-1": {
      id: "jennifer-1",
      name: "Jennifer Davis",
      parentIds: ["robert-1", "eleanor-1"],
      spouseId: "thomas-1",
      maidenName: "Johnson",
      birthOrder: 3
    },
    "thomas-1": {
      id: "thomas-1",
      name: "Thomas Davis",
      parentIds: [],
      spouseId: "jennifer-1"
    },

    // Generation 3 - Children (Michael's kids and Jennifer's kids)
    "emma-1": {
      id: "emma-1",
      name: "Emma Johnson",
      parentIds: ["michael-1", "sarah-1"],
      spouseId: null,
      birthOrder: 1
    },
    "liam-1": {
      id: "liam-1",
      name: "Liam Johnson",
      parentIds: ["michael-1", "sarah-1"],
      spouseId: null,
      birthOrder: 2
    },
    "olivia-1": {
      id: "olivia-1",
      name: "Olivia Davis",
      parentIds: ["jennifer-1", "thomas-1"],
      spouseId: null,
      birthOrder: 1
    },
    "noah-1": {
      id: "noah-1",
      name: "Noah Davis",
      parentIds: ["jennifer-1", "thomas-1"],
      spouseId: null,
      birthOrder: 2
    }
  }
};
