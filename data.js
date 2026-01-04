/*
  Family Tree Data

  Each person has:
  - id: unique identifier
  - name: display name
  - parentIds: array of parent IDs (empty for root ancestors)
  - spouseId: ID of spouse (null if unmarried)
  - birthOrder: number for sorting siblings (lower = older)

  Optional fields (for profiles):
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
  // The root generation (siblings at the top of the tree)
  rootPersonIds: ["robert-1"],

  // IDs of people whose branches are collapsed (persists with Local Storage later)
  collapsedIds: [],

  // All people in the family
  people: {
    // Generation 1 - Grandparents
    "robert-1": {
      id: "robert-1",
      name: "Robert Johnson",
      parentIds: [],
      spouseId: "eleanor-1",
      birthOrder: 1,
      alsoCalled: ["Grandpa", "Pop Pop", "Bob"],
      birthDate: { year: 1942, month: 3, day: 15 },
      deathDate: { year: 2019, month: 11 },
      location: ["Boston, MA"],
      occupation: "Carpenter",
      hobbies: "Woodworking, fishing, crossword puzzles",
      notes: "Built the family cabin in Vermont with his own hands. Always had butterscotch candies in his pocket."
    },
    "eleanor-1": {
      id: "eleanor-1",
      name: "Eleanor Johnson",
      parentIds: [],
      spouseId: "robert-1",
      alsoCalled: ["Grandma", "Ellie", "Nana"],
      birthDate: { year: 1945 },
      location: ["Boston, MA"],
      maidenName: "Mitchell",
      occupation: "Elementary School Teacher (retired)",
      education: "Boston University, B.Ed.",
      hobbies: "Gardening, baking, quilting",
      notes: "Famous for her apple pie recipe. Taught 3rd grade for 35 years."
    },

    // Generation 2 - Parents
    "michael-1": {
      id: "michael-1",
      name: "Michael Johnson",
      parentIds: ["robert-1", "eleanor-1"],
      spouseId: "sarah-1",
      birthOrder: 1,
      alsoCalled: ["Dad", "Mike"],
      birthDate: { year: 1968, month: 7, day: 4 },
      location: ["Cambridge, MA"],
      occupation: "Software Engineer at TechCorp",
      education: "MIT, Computer Science"
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

    // Generation 3 - Grandchildren
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
