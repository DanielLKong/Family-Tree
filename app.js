/*
  Family Tree App

  Renders the family tree dynamically from data.
  No frameworks - just vanilla JavaScript.
*/

// ============================================
// DATA HELPERS
// ============================================

/**
 * Get a person by their ID
 */
function getPersonById(id) {
  return familyData.people[id] || null;
}

/**
 * Get a person's spouse (if they have one)
 */
function getSpouse(personId) {
  const person = getPersonById(personId);
  if (!person || !person.spouseId) return null;
  return getPersonById(person.spouseId);
}

/**
 * Get all children of a person, sorted by birth order
 * (anyone whose parentIds includes this person)
 */
function getChildren(personId) {
  return Object.values(familyData.people)
    .filter(person => person.parentIds.includes(personId))
    .sort((a, b) => (a.birthOrder || 999) - (b.birthOrder || 999));
}

/**
 * Get siblings (people who share the same parents)
 */
function getSiblings(personId) {
  const person = getPersonById(personId);
  if (!person || person.parentIds.length === 0) return [];

  return Object.values(familyData.people).filter(p =>
    p.id !== personId &&
    p.parentIds.length > 0 &&
    p.parentIds.some(parentId => person.parentIds.includes(parentId))
  );
}

/**
 * Check if person is a blood relative (has parents in the tree)
 * or is a root ancestor
 */
function isBloodRelative(personId) {
  const person = getPersonById(personId);
  if (!person) return false;

  // Root person is always blood relative
  if (personId === familyData.rootPersonId) return true;

  // Has parents in tree = blood relative
  if (person.parentIds.length > 0) return true;

  // Check if they're spouse of root
  const rootPerson = getPersonById(familyData.rootPersonId);
  if (rootPerson && rootPerson.spouseId === personId) return false;

  // Otherwise, check if any blood relative has them as spouse
  return false;
}

/**
 * Get initials from a name (e.g., "Michael Johnson" -> "MJ")
 */
function getInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================
// TREE STRUCTURE
// ============================================

/**
 * Build generations starting from root person
 * Returns array of arrays, each containing person IDs for that generation
 */
function buildGenerations() {
  const generations = [];
  const visited = new Set();

  // Start with root person
  let currentGen = [familyData.rootPersonId];

  while (currentGen.length > 0) {
    generations.push(currentGen);
    currentGen.forEach(id => visited.add(id));

    // Find all children of current generation (blood relatives only)
    const nextGen = [];
    currentGen.forEach(personId => {
      const children = getChildren(personId);
      children.forEach(child => {
        if (!visited.has(child.id) && !nextGen.includes(child.id)) {
          nextGen.push(child.id);
        }
      });
    });

    currentGen = nextGen;
  }

  return generations;
}

/**
 * Group children by their parent couple
 * Returns array of { parentIds, children } objects
 */
function groupChildrenByParent(childIds) {
  const groups = new Map();

  childIds.forEach(childId => {
    const child = getPersonById(childId);
    // Create a key from sorted parent IDs
    const key = [...child.parentIds].sort().join('-');

    if (!groups.has(key)) {
      groups.set(key, {
        parentIds: child.parentIds,
        children: []
      });
    }
    groups.get(key).children.push(childId);
  });

  return Array.from(groups.values());
}

// ============================================
// RENDERING
// ============================================

/**
 * Render a single person card
 */
function renderPerson(personId, options = {}) {
  const person = getPersonById(personId);
  if (!person) return '';

  const spouse = getSpouse(personId);
  const initials = getInitials(person.name);

  // Build spouse HTML if exists
  let spouseHtml = '';
  if (spouse) {
    spouseHtml = `
      <div class="spouse-inline">
        <span class="spouse-label">Spouse</span>
        <span class="spouse-name">${spouse.name}</span>
      </div>
    `;
  }

  // Build maiden name HTML if exists
  let maidenHtml = '';
  if (person.maidenName) {
    maidenHtml = `<span class="maiden">née ${person.maidenName}</span>`;
  }

  // Menu button - always show
  const menuBtn = `<button class="card-menu-btn" data-person-id="${person.id}" title="Options">+</button>`;

  return `
    <article class="person-card" tabindex="0" data-person-id="${person.id}">
      ${menuBtn}
      <div class="card-main">
        <div class="avatar">
          <span>${initials}</span>
        </div>
        <div class="info">
          <h2 class="name">${person.name}</h2>
          ${maidenHtml}
        </div>
      </div>
      ${spouseHtml}
    </article>
  `;
}

/**
 * Render connector lines going down from a parent
 */
function renderConnectorDown(childCount) {
  // Calculate horizontal line width based on children
  const lineClass = childCount <= 2 ? 'short' : '';

  return `
    <div class="connector-down">
      <div class="line-v"></div>
      <div class="line-h ${lineClass}"></div>
    </div>
  `;
}

/**
 * Render connector line going up to parent
 */
function renderConnectorUp() {
  return `<div class="connector-up"></div>`;
}

/**
 * Render a generation row
 */
function renderGeneration(personIds, genNumber, isLastGen) {
  const genLabel = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][genNumber - 1] || genNumber;

  // Group by parent for proper spacing
  const groups = groupChildrenByParent(personIds);

  // First generation (root) - special case
  if (genNumber === 1) {
    const personId = personIds[0];
    const children = getChildren(personId);
    const spouse = getSpouse(personId);

    // Also count spouse's children if different
    let totalChildren = children.length;
    if (spouse) {
      const spouseChildren = getChildren(spouse.id);
      spouseChildren.forEach(sc => {
        if (!children.find(c => c.id === sc.id)) {
          totalChildren++;
        }
      });
    }

    return `
      <section class="generation" data-gen="${genNumber}">
        <div class="gen-label">Generation ${genLabel}</div>
        <div class="gen-content">
          ${renderPerson(personId)}
        </div>
        ${totalChildren > 0 ? renderConnectorDown(totalChildren) : ''}
      </section>
    `;
  }

  // Multiple people in generation
  if (groups.length === 1 && groups[0].children.length === personIds.length) {
    // All siblings from same parents
    const html = personIds.map((personId, index) => {
      const children = getChildren(personId);
      const hasChildren = children.length > 0;

      return `
        <div class="branch">
          ${renderConnectorUp()}
          ${renderPerson(personId)}
          ${hasChildren && !isLastGen ? renderConnectorDown(children.length) : ''}
        </div>
      `;
    }).join('');

    return `
      <section class="generation" data-gen="${genNumber}">
        <div class="gen-label">Generation ${genLabel}</div>
        <div class="gen-content">
          ${html}
        </div>
      </section>
    `;
  }

  // Multiple groups (cousins from different parents)
  const groupsHtml = groups.map(group => {
    const childrenHtml = group.children.map(childId => {
      return `
        <div class="child-branch">
          ${renderConnectorUp()}
          ${renderPerson(childId)}
        </div>
      `;
    }).join('');

    return `<div class="children-group">${childrenHtml}</div>`;
  }).join('');

  return `
    <section class="generation" data-gen="${genNumber}">
      <div class="gen-label">Generation ${genLabel}</div>
      <div class="gen-content">
        ${groupsHtml}
      </div>
    </section>
  `;
}

/**
 * Render the entire tree
 */
function renderTree() {
  const generations = buildGenerations();
  const treeContainer = document.querySelector('.tree');

  if (!treeContainer) {
    console.error('Tree container not found');
    return;
  }

  const html = generations.map((genPersonIds, index) =>
    renderGeneration(genPersonIds, index + 1, index === generations.length - 1)
  ).join('');

  treeContainer.innerHTML = html;

  // Add click handlers for person cards
  document.querySelectorAll('.person-card').forEach(card => {
    card.addEventListener('click', handleCardClick);
  });

  // Add click handlers for menu buttons
  document.querySelectorAll('.card-menu-btn').forEach(btn => {
    btn.addEventListener('click', handleMenuClick);
  });
}

/**
 * Handle click on a person card
 */
function handleCardClick(event) {
  const card = event.currentTarget;
  const personId = card.dataset.personId;
  const person = getPersonById(personId);

  if (person) {
    console.log('Clicked:', person.name);
    // TODO: Show profile modal
  }
}

/**
 * Handle click on menu button - show dropdown
 */
function handleMenuClick(event) {
  event.stopPropagation();
  const button = event.currentTarget;
  const personId = button.dataset.personId;
  const card = button.closest('.person-card');
  const person = getPersonById(personId);
  const spouse = getSpouse(personId);

  // Close any existing dropdowns/forms
  closeAllPopups();

  // Create dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'card-dropdown';

  // Add Child option - always available
  const addChildBtn = document.createElement('button');
  addChildBtn.className = 'card-dropdown-item';
  addChildBtn.textContent = 'Add Child';
  addChildBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showAddChildForm(personId, card);
  });
  dropdown.appendChild(addChildBtn);

  // Add/Edit Spouse option
  const spouseBtn = document.createElement('button');
  spouseBtn.className = 'card-dropdown-item';
  spouseBtn.textContent = spouse ? 'Edit Spouse' : 'Add Spouse';
  spouseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showSpouseForm(personId, card, spouse);
  });
  dropdown.appendChild(spouseBtn);

  card.appendChild(dropdown);
}

/**
 * Show form to add a child
 */
function showAddChildForm(parentId, card) {
  closeAllPopups();

  const form = document.createElement('form');
  form.className = 'add-form';
  form.innerHTML = `
    <input type="text" name="childName" placeholder="Child's full name" autofocus>
    <div class="add-form-buttons">
      <button type="button" onclick="closeAllPopups()">Cancel</button>
      <button type="submit">Add</button>
    </div>
  `;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('input[name="childName"]').value.trim();
    if (name) {
      addChild(parentId, name);
      closeAllPopups();
      // Show reorder panel after adding
      showReorderPanel(parentId);
    }
  });

  card.appendChild(form);
  form.querySelector('input').focus();
}

/**
 * Show form to add or edit spouse
 */
function showSpouseForm(personId, card, existingSpouse) {
  closeAllPopups();

  const form = document.createElement('form');
  form.className = 'add-form';
  form.innerHTML = `
    <input type="text" name="spouseName" placeholder="Spouse's full name" value="${existingSpouse ? existingSpouse.name : ''}" autofocus>
    <div class="add-form-buttons">
      <button type="button" onclick="closeAllPopups()">Cancel</button>
      <button type="submit">${existingSpouse ? 'Update' : 'Add'}</button>
    </div>
  `;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('input[name="spouseName"]').value.trim();
    if (name) {
      if (existingSpouse) {
        updatePerson(existingSpouse.id, { name });
      } else {
        addSpouse(personId, name);
      }
      closeAllPopups();
    }
  });

  card.appendChild(form);
  form.querySelector('input').focus();
}

/**
 * Close any open dropdowns or forms
 */
function closeAllPopups() {
  document.querySelectorAll('.card-dropdown, .add-form').forEach(el => el.remove());
}

/**
 * Show the reorder panel for children
 */
function showReorderPanel(parentId) {
  // Close any existing panel
  closeReorderPanel();

  const children = getChildren(parentId);
  if (children.length < 2) return; // No need to reorder 0 or 1 child

  const parent = getPersonById(parentId);

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'reorder-overlay';
  overlay.addEventListener('click', closeReorderPanel);
  document.body.appendChild(overlay);

  // Create panel
  const panel = document.createElement('div');
  panel.className = 'reorder-panel';

  const title = parent.name.split(' ')[0] + "'s Children";

  panel.innerHTML = `
    <h3>${title}</h3>
    <p>Drag to reorder by birth (oldest first)</p>
    <ul class="reorder-list"></ul>
    <button class="done-btn" onclick="closeReorderPanel()">Done</button>
  `;

  const list = panel.querySelector('.reorder-list');

  // Add children to list
  children.forEach((child, index) => {
    const item = document.createElement('li');
    item.className = 'reorder-item';
    item.draggable = true;
    item.dataset.childId = child.id;
    item.innerHTML = `
      <span class="drag-handle">☰</span>
      <span class="child-name">${child.name}</span>
      <span class="order-num">${index + 1}</span>
    `;

    // Drag events
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);

    list.appendChild(item);
  });

  document.body.appendChild(panel);
}

/**
 * Close the reorder panel
 */
function closeReorderPanel() {
  document.querySelectorAll('.reorder-panel, .reorder-overlay').forEach(el => el.remove());
}

// Drag and drop state
let draggedItem = null;

function handleDragStart(e) {
  draggedItem = e.target.closest('.reorder-item');
  draggedItem.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  e.target.closest('.reorder-item').classList.remove('dragging');
  document.querySelectorAll('.reorder-item').forEach(item => {
    item.classList.remove('drag-over');
  });

  // Update birth orders based on new positions
  const list = document.querySelector('.reorder-list');
  if (list) {
    const items = list.querySelectorAll('.reorder-item');
    items.forEach((item, index) => {
      const childId = item.dataset.childId;
      const child = getPersonById(childId);
      if (child) {
        child.birthOrder = index + 1;
      }
      // Update the displayed order number
      item.querySelector('.order-num').textContent = index + 1;
    });

    // Re-render the tree with new order
    renderTree();
  }

  draggedItem = null;
}

function handleDragOver(e) {
  e.preventDefault();
  const item = e.target.closest('.reorder-item');
  if (item && item !== draggedItem) {
    item.classList.add('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const dropTarget = e.target.closest('.reorder-item');

  if (dropTarget && draggedItem && dropTarget !== draggedItem) {
    const list = dropTarget.parentNode;
    const allItems = [...list.querySelectorAll('.reorder-item')];
    const draggedIndex = allItems.indexOf(draggedItem);
    const dropIndex = allItems.indexOf(dropTarget);

    if (draggedIndex < dropIndex) {
      dropTarget.parentNode.insertBefore(draggedItem, dropTarget.nextSibling);
    } else {
      dropTarget.parentNode.insertBefore(draggedItem, dropTarget);
    }
  }

  document.querySelectorAll('.reorder-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

// ============================================
// DATA MODIFICATION
// ============================================

/**
 * Generate a unique ID for a new person
 */
function generateId(name) {
  const baseName = name.toLowerCase().split(' ')[0];
  let counter = 1;

  while (familyData.people[`${baseName}-${counter}`]) {
    counter++;
  }

  return `${baseName}-${counter}`;
}

/**
 * Add a new person to the family
 */
function addPerson(name, parentIds = [], spouseId = null, birthOrder = null) {
  const id = generateId(name);

  familyData.people[id] = {
    id,
    name,
    parentIds,
    spouseId,
    birthOrder
  };

  // If adding as spouse, update the other person too
  if (spouseId) {
    const spouse = getPersonById(spouseId);
    if (spouse) {
      spouse.spouseId = id;
    }
  }

  renderTree();
  return id;
}

/**
 * Add a child to a person (and their spouse)
 */
function addChild(parentId, childName) {
  const parent = getPersonById(parentId);
  if (!parent) return null;

  const parentIds = [parentId];
  if (parent.spouseId) {
    parentIds.push(parent.spouseId);
  }

  // Get existing children to determine birth order
  const existingChildren = getChildren(parentId);
  const maxOrder = existingChildren.reduce((max, child) =>
    Math.max(max, child.birthOrder || 0), 0);

  return addPerson(childName, parentIds, null, maxOrder + 1);
}

/**
 * Add a spouse to a person
 */
function addSpouse(personId, spouseName) {
  const person = getPersonById(personId);
  if (!person || person.spouseId) return null;

  return addPerson(spouseName, [], personId);
}

/**
 * Update a person's details
 */
function updatePerson(personId, updates) {
  const person = getPersonById(personId);
  if (!person) return false;

  Object.assign(person, updates);
  renderTree();
  return true;
}

/**
 * Remove a person from the family
 */
function removePerson(personId) {
  const person = getPersonById(personId);
  if (!person) return false;

  // Remove as spouse from partner
  if (person.spouseId) {
    const spouse = getPersonById(person.spouseId);
    if (spouse) {
      spouse.spouseId = null;
    }
  }

  // Remove from any children's parentIds
  Object.values(familyData.people).forEach(p => {
    p.parentIds = p.parentIds.filter(id => id !== personId);
  });

  delete familyData.people[personId];
  renderTree();
  return true;
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the app when DOM is ready
 */
function init() {
  renderTree();

  // Close popups when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-dropdown') &&
        !e.target.closest('.add-form') &&
        !e.target.closest('.card-menu-btn')) {
      closeAllPopups();
    }
  });

  console.log('Family Tree initialized');
}

// Run when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
