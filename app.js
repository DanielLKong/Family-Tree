/*
  Family Tree App

  Renders the family tree dynamically from data.
  No frameworks - just vanilla JavaScript.
*/

// ============================================
// MULTI-TREE STORAGE & PERSISTENCE
// ============================================

const STORAGE_KEY = 'familyTreeData';
const STORAGE_VERSION = 2;

// Global state for multi-tree management
let allTreesData = null;
let activeTreeId = null;

/**
 * Generate unique tree ID
 */
function generateTreeId() {
  return 'tree-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Migrate v1 data to v2 structure
 */
function migrateToV2(v1Data) {
  const treeId = generateTreeId();
  const now = new Date().toISOString();

  return {
    version: 2,
    activeTreeId: treeId,
    trees: {
      [treeId]: {
        id: treeId,
        ...v1Data.data,
        createdAt: v1Data.savedAt || now,
        updatedAt: v1Data.savedAt || now
      }
    }
  };
}

/**
 * Load all trees data from cloud (if signed in) or localStorage
 */
async function loadAllTreesData() {
  try {
    // If signed in, try to load from cloud first
    if (typeof currentUser !== 'undefined' && currentUser && typeof loadTreesFromCloud === 'function') {
      const cloudData = await loadTreesFromCloud();
      if (cloudData && Object.keys(cloudData.trees).length > 0) {
        allTreesData = cloudData;
        activeTreeId = cloudData.activeTreeId;

        // Load active tree into familyData
        if (activeTreeId && allTreesData.trees[activeTreeId]) {
          loadTreeIntoFamilyData(activeTreeId);
        } else if (Object.keys(allTreesData.trees).length > 0) {
          activeTreeId = Object.keys(allTreesData.trees)[0];
          allTreesData.activeTreeId = activeTreeId;
          loadTreeIntoFamilyData(activeTreeId);
        }
        return true;
      }
    }

    // Fall back to localStorage
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      // No saved data - create structure with default tree from data.js
      const defaultTreeId = generateTreeId();
      const now = new Date().toISOString();

      allTreesData = {
        version: 2,
        activeTreeId: defaultTreeId,
        trees: {
          [defaultTreeId]: {
            id: defaultTreeId,
            title: familyData.title,
            tagline: familyData.tagline,
            rootPersonIds: familyData.rootPersonIds,
            collapsedIds: familyData.collapsedIds || [],
            people: familyData.people,
            createdAt: now,
            updatedAt: now
          }
        }
      };
      activeTreeId = defaultTreeId;
      await saveAllTreesData();
      return true;
    }

    const parsed = JSON.parse(stored);

    // Check version and migrate if needed
    if (!parsed.version || parsed.version === 1) {
      console.log('Migrating from v1 to v2 storage format');
      allTreesData = migrateToV2(parsed);
      activeTreeId = allTreesData.activeTreeId;
      await saveAllTreesData();
    } else {
      allTreesData = parsed;
      activeTreeId = parsed.activeTreeId;
    }

    // Load active tree into familyData (if there is one)
    if (activeTreeId && allTreesData.trees[activeTreeId]) {
      loadTreeIntoFamilyData(activeTreeId);
    } else if (Object.keys(allTreesData.trees).length > 0) {
      // Active tree not found, load first available
      activeTreeId = Object.keys(allTreesData.trees)[0];
      allTreesData.activeTreeId = activeTreeId;
      loadTreeIntoFamilyData(activeTreeId);
    } else {
      // No trees at all - set up empty state
      activeTreeId = null;
      allTreesData.activeTreeId = null;
      clearFamilyData();
    }

    return true;
  } catch (e) {
    console.error('Failed to load trees data:', e);
    return false;
  }
}

/**
 * Save all trees data to localStorage AND cloud (if signed in)
 * @param {boolean} saveAllToCloud - If true, save ALL trees to cloud (used after creating/switching trees)
 */
async function saveAllTreesData(saveAllToCloud = false) {
  try {
    // ALWAYS save to localStorage first (as backup)
    const json = JSON.stringify(allTreesData);
    const sizeInMB = new Blob([json]).size / (1024 * 1024);

    if (sizeInMB > 4.5) {
      console.warn('Data approaching localStorage limit:', sizeInMB.toFixed(2), 'MB');
    }

    localStorage.setItem(STORAGE_KEY, json);

    // ALSO save to cloud if signed in
    if (typeof currentUser !== 'undefined' && currentUser && typeof saveTreeToCloud === 'function') {
      if (saveAllToCloud) {
        // Save ALL trees to cloud (used when creating new trees)
        for (const tree of Object.values(allTreesData.trees)) {
          const success = await saveTreeToCloud(tree);
          if (!success) {
            console.warn('Cloud save failed for tree:', tree.id);
          }
        }
      } else if (activeTreeId) {
        // Just save the active tree (normal edits)
        const tree = allTreesData.trees[activeTreeId];
        if (tree) {
          const success = await saveTreeToCloud(tree);
          if (!success) {
            console.warn('Cloud save failed, but localStorage backup succeeded');
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to save:', e);
    if (e.name === 'QuotaExceededError') {
      alert('Storage is full. Please delete some trees or photos.');
    }
  }
}

/**
 * Load a specific tree into familyData (the working object)
 */
function loadTreeIntoFamilyData(treeId) {
  const tree = allTreesData.trees[treeId];
  if (!tree) return false;

  // Clear and replace familyData contents
  Object.keys(familyData).forEach(key => delete familyData[key]);
  Object.assign(familyData, {
    title: tree.title,
    tagline: tree.tagline,
    rootPersonIds: tree.rootPersonIds || [],
    collapsedIds: tree.collapsedIds || [],
    people: tree.people || {}
  });

  activeTreeId = treeId;
  allTreesData.activeTreeId = treeId;
  return true;
}

/**
 * Clear familyData for empty state
 */
function clearFamilyData() {
  Object.keys(familyData).forEach(key => delete familyData[key]);
  Object.assign(familyData, {
    title: '',
    tagline: '',
    rootPersonIds: [],
    collapsedIds: [],
    people: {}
  });
}

/**
 * Save current familyData back to its tree in allTreesData
 */
function saveCurrentTreeData() {
  if (!activeTreeId || !allTreesData.trees[activeTreeId]) return;

  const tree = allTreesData.trees[activeTreeId];
  tree.title = familyData.title;
  tree.tagline = familyData.tagline;
  tree.rootPersonIds = familyData.rootPersonIds;
  tree.collapsedIds = familyData.collapsedIds;
  tree.people = familyData.people;
  tree.updatedAt = new Date().toISOString();
}

/**
 * Save to storage (cloud if signed in, localStorage otherwise)
 */
function saveToLocalStorage() {
  if (activeTreeId) {
    saveCurrentTreeData();
  }
  // Fire and forget - don't await to keep UI responsive
  saveAllTreesData();
}

/**
 * Switch to a different tree
 */
function switchToTree(treeId) {
  if (treeId === activeTreeId) {
    closeSidebar();
    return;
  }

  // Save current tree first
  if (activeTreeId) {
    saveCurrentTreeData();
  }

  // Load new tree
  loadTreeIntoFamilyData(treeId);
  saveAllTreesData();

  // Refresh UI
  initEditableHeader();
  renderTree();
  closeSidebar();
}

/**
 * Create a new empty tree
 */
function createNewTree() {
  // Only signed-in users can create multiple trees
  const isSignedIn = typeof currentUser !== 'undefined' && currentUser;
  if (!isSignedIn) {
    // Open sign-in modal instead
    if (typeof openAuthModal === 'function') {
      openAuthModal();
    }
    return;
  }

  // Save current tree first
  if (activeTreeId) {
    saveCurrentTreeData();
  }

  const treeId = generateTreeId();
  const now = new Date().toISOString();

  allTreesData.trees[treeId] = {
    id: treeId,
    title: 'New Family',
    tagline: 'Click to edit',
    rootPersonIds: [],
    collapsedIds: [],
    people: {},
    createdAt: now,
    updatedAt: now
  };

  // Switch to new tree
  loadTreeIntoFamilyData(treeId);
  // Save ALL trees to cloud (so existing trees don't get lost)
  saveAllTreesData(true);

  // Refresh UI
  initEditableHeader();
  renderTree();
  renderTreesList();
}

/**
 * Delete a tree
 */
async function deleteTree(treeId) {
  const tree = allTreesData.trees[treeId];
  if (!tree) return;

  // Delete from cloud if signed in
  if (typeof currentUser !== 'undefined' && currentUser && typeof deleteTreeFromCloud === 'function') {
    await deleteTreeFromCloud(treeId);
  }

  delete allTreesData.trees[treeId];

  const remainingIds = Object.keys(allTreesData.trees);

  if (treeId === activeTreeId) {
    // Deleted the active tree
    if (remainingIds.length > 0) {
      // Switch to another tree
      loadTreeIntoFamilyData(remainingIds[0]);
    } else {
      // No trees left - clear everything
      activeTreeId = null;
      allTreesData.activeTreeId = null;
      clearFamilyData();
    }
    initEditableHeader();
    renderTree();
  }

  await saveAllTreesData();
  renderTreesList();
  closeDeleteModal();
}

/**
 * Get list of all trees sorted by updated date
 */
function getTreesList() {
  return Object.values(allTreesData.trees)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// ============================================
// SIDEBAR UI
// ============================================

let sidebarVisible = false;
let deleteModalTreeId = null;

/**
 * Initialize sidebar
 */
function initSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const close = document.getElementById('sidebar-close');
  const overlay = document.getElementById('sidebar-overlay');
  const newTreeBtn = document.getElementById('new-tree-btn');

  if (toggle) toggle.addEventListener('click', openSidebar);
  if (close) close.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
  if (newTreeBtn) newTreeBtn.addEventListener('click', createNewTree);

  // Keyboard: Escape to close sidebar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarVisible) {
      closeSidebar();
    }
  });
}

/**
 * Open sidebar
 */
function openSidebar() {
  const sidebar = document.getElementById('trees-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (sidebar) sidebar.classList.add('visible');
  if (overlay) overlay.classList.add('visible');
  sidebarVisible = true;

  renderTreesList();
}

/**
 * Close sidebar
 */
function closeSidebar() {
  const sidebar = document.getElementById('trees-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (sidebar) sidebar.classList.remove('visible');
  if (overlay) overlay.classList.remove('visible');
  sidebarVisible = false;
}

/**
 * Render the trees list in sidebar
 */
function renderTreesList() {
  const listEl = document.getElementById('trees-list');
  if (!listEl) return;

  const trees = getTreesList();

  // Show/hide New Tree button based on auth state
  // Guests can only have 1 tree, signed-in users can have unlimited
  const newTreeBtn = document.getElementById('new-tree-btn');
  if (newTreeBtn) {
    const isSignedIn = typeof currentUser !== 'undefined' && currentUser;
    newTreeBtn.style.display = isSignedIn ? '' : 'none';
  }

  if (trees.length === 0) {
    listEl.innerHTML = `
      <li class="trees-empty-state">
        <p>No family trees yet</p>
        <p class="trees-empty-hint">Click "New Tree" to get started</p>
      </li>
    `;
    return;
  }

  listEl.innerHTML = trees.map(tree => {
    const personCount = Object.keys(tree.people || {}).length;
    const isActive = tree.id === activeTreeId;
    const displayTitle = tree.title || 'Untitled';

    return `
      <li class="tree-item ${isActive ? 'active' : ''}" data-tree-id="${tree.id}">
        <div class="tree-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
            <path d="M12 3v18M5 8h14M7 13h10M9 18h6"/>
          </svg>
        </div>
        <div class="tree-item-info">
          <div class="tree-item-name">${escapeHtml(displayTitle)}</div>
          <div class="tree-item-meta">${personCount} ${personCount === 1 ? 'person' : 'people'}</div>
        </div>
        <div class="tree-item-actions">
          <button class="tree-item-delete" data-tree-id="${tree.id}" title="Delete tree">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </li>
    `;
  }).join('');

  // Add click handlers
  listEl.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.tree-item-delete')) return;
      const treeId = item.dataset.treeId;
      switchToTree(treeId);
    });
  });

  listEl.querySelectorAll('.tree-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const treeId = btn.dataset.treeId;
      showDeleteModal(treeId);
    });
  });
}

/**
 * Helper to escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show delete confirmation modal
 */
function showDeleteModal(treeId) {
  deleteModalTreeId = treeId;
  const tree = allTreesData.trees[treeId];
  const treeName = tree ? (tree.title || 'Untitled') : 'this tree';

  // Create modal if doesn't exist
  let modal = document.querySelector('.delete-tree-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'delete-tree-modal';
    modal.innerHTML = `
      <div class="delete-tree-modal-backdrop"></div>
      <div class="delete-tree-modal-content">
        <h3>Delete Tree?</h3>
        <p class="delete-tree-message"></p>
        <div class="delete-tree-modal-actions">
          <button class="delete-tree-cancel">Cancel</button>
          <button class="delete-tree-confirm">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.delete-tree-modal-backdrop').addEventListener('click', closeDeleteModal);
    modal.querySelector('.delete-tree-cancel').addEventListener('click', closeDeleteModal);
    modal.querySelector('.delete-tree-confirm').addEventListener('click', () => {
      deleteTree(deleteModalTreeId);
    });
  }

  modal.querySelector('.delete-tree-message').textContent =
    `Are you sure you want to delete "${treeName}"? This cannot be undone.`;

  modal.classList.add('visible');
}

/**
 * Close delete confirmation modal
 */
function closeDeleteModal() {
  const modal = document.querySelector('.delete-tree-modal');
  if (modal) modal.classList.remove('visible');
  deleteModalTreeId = null;
}

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

/**
 * Count all descendants of a person (children, grandchildren, etc.)
 */
function countDescendants(personId) {
  const children = getChildren(personId);
  let count = children.length;
  children.forEach(child => {
    count += countDescendants(child.id);
  });
  return count;
}

/**
 * Check if a person's branch is collapsed
 */
function isCollapsed(personId) {
  return familyData.collapsedIds.includes(personId);
}

/**
 * Toggle collapsed state for a person
 */
function toggleCollapsed(personId) {
  const index = familyData.collapsedIds.indexOf(personId);
  if (index > -1) {
    familyData.collapsedIds.splice(index, 1);
  } else {
    familyData.collapsedIds.push(personId);
  }
  renderTree();
}

/**
 * Collapse all branches (people with children)
 */
function collapseAll() {
  const peopleWithChildren = Object.values(familyData.people)
    .filter(person => getChildren(person.id).length > 0)
    .map(person => person.id);

  familyData.collapsedIds = peopleWithChildren;
  renderTree();
}

/**
 * Expand all branches
 */
function expandAll() {
  familyData.collapsedIds = [];
  renderTree();
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
  const children = getChildren(personId);
  const hasChildren = children.length > 0;
  const collapsed = isCollapsed(personId);

  // Build spouse HTML if exists
  let spouseHtml = '';
  if (spouse) {
    // Build spouse nickname cycler if spouse has nicknames
    let spouseNicknameHtml = '';
    if (spouse.alsoCalled && spouse.alsoCalled.length > 0) {
      const showArrows = spouse.alsoCalled.length > 1;
      spouseNicknameHtml = `
        <div class="nickname-cycler spouse-nickname" data-person-id="${spouse.id}" data-index="0">
          <button class="nickname-arrow nickname-prev" title="Previous nickname" ${!showArrows ? 'style="visibility:hidden"' : ''}>‹</button>
          <span class="nickname-text">${spouse.alsoCalled[0]}</span>
          <button class="nickname-arrow nickname-next" title="Next nickname" ${!showArrows ? 'style="visibility:hidden"' : ''}>›</button>
        </div>
      `;
    }
    spouseHtml = `
      <div class="spouse-inline">
        <span class="spouse-label">Spouse</span>
        <div class="spouse-info">
          <span class="spouse-name" data-spouse-id="${spouse.id}">${spouse.name}</span>
          ${spouseNicknameHtml}
        </div>
      </div>
    `;
  }

  // Build maiden name HTML if exists
  let maidenHtml = '';
  if (person.maidenName) {
    maidenHtml = `<span class="maiden">née ${person.maidenName}</span>`;
  }

  // Menu button - three dots
  const menuBtn = `<button class="card-menu-btn" data-person-id="${person.id}" title="Options">⋮</button>`;

  // Collapse toggle button (only if has children)
  let collapseBtn = '';
  if (hasChildren) {
    const icon = collapsed ? '▶' : '▼';
    const badge = collapsed ? `<span class="collapse-badge">+${children.length}</span>` : '';
    collapseBtn = `
      <button class="collapse-btn ${collapsed ? 'collapsed' : ''}" data-person-id="${person.id}" title="${collapsed ? 'Expand' : 'Collapse'}">
        <span class="collapse-icon">${icon}</span>
        ${badge}
      </button>
    `;
  }

  // Avatar - show photo if exists, otherwise initials
  const hasPhoto = person.photo && person.photo.length > 0;
  const avatarContent = hasPhoto
    ? `<img src="${person.photo}" alt="${person.name}" class="avatar-img">`
    : `<span>${initials}</span>`;

  // Build nickname cycler HTML if person has nicknames
  let nicknameHtml = '';
  if (person.alsoCalled && person.alsoCalled.length > 0) {
    const showArrows = person.alsoCalled.length > 1;
    nicknameHtml = `
      <div class="nickname-cycler" data-person-id="${person.id}" data-index="0">
        <button class="nickname-arrow nickname-prev" title="Previous nickname" ${!showArrows ? 'style="visibility:hidden"' : ''}>‹</button>
        <span class="nickname-text">${person.alsoCalled[0]}</span>
        <button class="nickname-arrow nickname-next" title="Next nickname" ${!showArrows ? 'style="visibility:hidden"' : ''}>›</button>
      </div>
    `;
  }

  return `
    <article class="person-card ${collapsed ? 'is-collapsed' : ''}" tabindex="0" data-person-id="${person.id}">
      ${menuBtn}
      <div class="card-main">
        <div class="avatar ${hasPhoto ? 'has-photo' : ''}">
          ${avatarContent}
        </div>
        <div class="info">
          <h2 class="name">${person.name}</h2>
          ${nicknameHtml}
        </div>
      </div>
      ${spouseHtml}
      ${collapseBtn}
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
 * Render a family branch (person + their children recursively)
 */
function renderBranch(personId, isRoot = false) {
  const person = getPersonById(personId);
  if (!person) return '';

  const children = getChildren(personId);
  const hasChildren = children.length > 0;
  const spouse = getSpouse(personId);
  const noSpouseClass = !spouse ? 'no-spouse' : '';
  const collapsed = isCollapsed(personId);

  // Render children branches (only if not collapsed)
  let childrenHtml = '';
  if (hasChildren && !collapsed) {
    const childBranches = children.map(child => renderBranch(child.id)).join('');
    childrenHtml = `
      <div class="branch-connector"></div>
      <div class="branch-children">${childBranches}</div>
    `;
  }

  return `
    <div class="family-branch ${isRoot ? 'root-branch' : ''} ${noSpouseClass} ${collapsed ? 'is-collapsed' : ''}">
      ${renderPerson(personId)}
      ${childrenHtml}
    </div>
  `;
}

/**
 * Render the entire tree
 */
function renderTree() {
  const treeContainer = document.querySelector('.tree');

  if (!treeContainer) {
    console.error('Tree container not found');
    return;
  }

  // Get root people sorted by birth order
  const rootPeople = familyData.rootPersonIds
    .map(id => getPersonById(id))
    .filter(p => p)
    .sort((a, b) => (a.birthOrder || 999) - (b.birthOrder || 999));

  let html;

  // Empty state - no people yet
  if (rootPeople.length === 0) {
    html = `
      <div class="empty-state">
        <button class="add-first-person" title="Add first person">
          <span class="plus-icon">+</span>
        </button>
        <p class="empty-hint">Click to add your first family member</p>
      </div>
    `;
  } else if (rootPeople.length === 1) {
    // Single root - render as before
    html = renderBranch(rootPeople[0].id, true);
  } else {
    // Multiple roots - render as siblings with connector
    const branches = rootPeople.map(p => renderBranch(p.id, true)).join('');
    html = `
      <div class="root-siblings">
        ${branches}
      </div>
    `;
  }

  treeContainer.innerHTML = html;

  // Add click handler for empty state button
  const addFirstBtn = document.querySelector('.add-first-person');
  if (addFirstBtn) {
    addFirstBtn.addEventListener('click', showAddFirstPersonForm);
  }

  // Add click handlers for person cards
  document.querySelectorAll('.person-card').forEach(card => {
    card.addEventListener('click', handleCardClick);
  });

  // Add click handlers for menu buttons
  document.querySelectorAll('.card-menu-btn').forEach(btn => {
    btn.addEventListener('click', handleMenuClick);
  });

  // Add click handlers for collapse buttons
  document.querySelectorAll('.collapse-btn').forEach(btn => {
    btn.addEventListener('click', handleCollapseClick);
  });

  // Add click handlers for person names (opens profile)
  document.querySelectorAll('.person-card .name').forEach(name => {
    name.addEventListener('click', handleNameClick);
  });

  // Add click handlers for spouse names (opens their profile)
  document.querySelectorAll('.person-card .spouse-name').forEach(name => {
    name.addEventListener('click', handleSpouseNameClick);
  });

  // Add click handlers for nickname arrows
  document.querySelectorAll('.nickname-arrow').forEach(arrow => {
    arrow.addEventListener('click', handleNicknameArrowClick);
  });

  // Auto-save after any tree render
  saveToLocalStorage();
}

/**
 * Handle click on collapse button
 */
function handleCollapseClick(event) {
  event.stopPropagation();
  const button = event.currentTarget;
  const personId = button.dataset.personId;
  toggleCollapsed(personId);
}

/**
 * Show form to add the first person
 */
function showAddFirstPersonForm() {
  const emptyState = document.querySelector('.empty-state');
  if (!emptyState) return;

  // Hide the button and hint
  emptyState.innerHTML = `
    <form class="add-first-form">
      <input type="text" name="personName" placeholder="Enter name (e.g., Grandpa John)" autofocus>
      <div class="add-first-buttons">
        <button type="button" class="cancel-btn">Cancel</button>
        <button type="submit">Add</button>
      </div>
    </form>
  `;

  const form = emptyState.querySelector('form');
  const cancelBtn = emptyState.querySelector('.cancel-btn');

  cancelBtn.addEventListener('click', () => {
    renderTree(); // Re-render to show empty state again
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('input[name="personName"]').value.trim();
    if (name) {
      addFirstPerson(name);
    }
  });

  form.querySelector('input').focus();
}

/**
 * Add the first person to the tree
 */
function addFirstPerson(name) {
  const id = generateId(name);
  familyData.people[id] = {
    id,
    name,
    parentIds: [],
    spouseId: null,
    birthOrder: 1
  };
  familyData.rootPersonIds.push(id);
  renderTree();
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

  // Edit option
  const editBtn = document.createElement('button');
  editBtn.className = 'card-dropdown-item';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showEditForm(personId, card);
  });
  dropdown.appendChild(editBtn);

  // Add Child option - always available
  const addChildBtn = document.createElement('button');
  addChildBtn.className = 'card-dropdown-item';
  addChildBtn.textContent = 'Add Child';
  addChildBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showAddChildForm(personId, card);
  });
  dropdown.appendChild(addChildBtn);

  // Add Sibling option - always available
  const addSiblingBtn = document.createElement('button');
  addSiblingBtn.className = 'card-dropdown-item';
  addSiblingBtn.textContent = 'Add Sibling';
  addSiblingBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showAddSiblingForm(personId, card);
  });
  dropdown.appendChild(addSiblingBtn);

  // Edit Birth Order option - if has siblings
  const hasSiblings = person.parentIds.length > 0
    ? getChildren(person.parentIds[0]).length > 1
    : familyData.rootPersonIds.length > 1;

  if (hasSiblings) {
    const reorderBtn = document.createElement('button');
    reorderBtn.className = 'card-dropdown-item';
    reorderBtn.textContent = 'Edit Birth Order';
    reorderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllPopups();
      if (person.parentIds.length > 0) {
        showReorderPanel(person.parentIds[0]);
      } else {
        showRootReorderPanel();
      }
    });
    dropdown.appendChild(reorderBtn);
  }

  // Add/Edit Spouse option
  const spouseBtn = document.createElement('button');
  spouseBtn.className = 'card-dropdown-item';
  spouseBtn.textContent = spouse ? 'Edit Spouse' : 'Add Spouse';
  spouseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showSpouseForm(personId, card, spouse);
  });
  dropdown.appendChild(spouseBtn);

  // Delete option
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'card-dropdown-item delete-item';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showDeleteConfirm(personId, card);
  });
  dropdown.appendChild(deleteBtn);

  card.appendChild(dropdown);
}

/**
 * Show unified panel to add/manage children
 */
function showAddChildForm(parentId, card) {
  closeAllPopups();
  showManageChildrenPanel(parentId);
}

/**
 * Show panel to manage children (add multiple + reorder)
 */
function showManageChildrenPanel(parentId) {
  closeReorderPanel();

  const parent = getPersonById(parentId);
  if (!parent) return;

  const children = getChildren(parentId);

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'reorder-overlay';
  overlay.addEventListener('click', () => saveAndCloseManagePanel(parentId));
  document.body.appendChild(overlay);

  // Create panel
  const panel = document.createElement('div');
  panel.className = 'reorder-panel manage-panel';
  panel.dataset.parentId = parentId;

  const title = parent.name.split(' ')[0] + "'s Children";

  panel.innerHTML = `
    <h3>${title}</h3>
    <p>Add children and drag to reorder (oldest first)</p>
    <ul class="reorder-list"></ul>
    <button class="done-btn">Done</button>
  `;

  const list = panel.querySelector('.reorder-list');

  // Add existing children
  children.forEach((child, index) => {
    addManageRow(list, child.name, child.id, index + 1);
  });

  // Add empty row for new entry
  addEmptyRow(list, parentId, 'child');

  // Done button
  panel.querySelector('.done-btn').addEventListener('click', () => {
    saveAndCloseManagePanel(parentId);
  });

  // Enter key saves the panel
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveAndCloseManagePanel(parentId);
    }
  });

  document.body.appendChild(panel);

  // Focus first empty input
  const emptyInput = panel.querySelector('.manage-input:not([data-person-id])');
  if (emptyInput) emptyInput.focus();
}

/**
 * Add a row to the manage panel (existing person)
 */
function addManageRow(list, name, personId, orderNum) {
  const item = document.createElement('li');
  item.className = 'reorder-item manage-row';
  item.draggable = true;
  if (personId) item.dataset.personId = personId;

  item.innerHTML = `
    <span class="drag-handle">☰</span>
    <input type="text" class="manage-input" value="${name}" placeholder="Enter name..." ${personId ? `data-person-id="${personId}"` : ''}>
    <span class="order-num">${orderNum}</span>
    ${personId ? '<button class="remove-row" tabindex="-1" title="Remove">×</button>' : ''}
  `;

  // Drag events
  item.addEventListener('dragstart', handleDragStart);
  item.addEventListener('dragend', handleManageDragEnd);
  item.addEventListener('dragover', handleDragOver);
  item.addEventListener('drop', handleDrop);

  // Remove button
  const removeBtn = item.querySelector('.remove-row');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      item.remove();
      updateOrderNumbers();
    });
  }

  list.appendChild(item);
  return item;
}

/**
 * Add empty row for new entry
 */
function addEmptyRow(list, parentId, type) {
  const orderNum = list.querySelectorAll('.reorder-item').length + 1;
  const item = document.createElement('li');
  item.className = 'reorder-item manage-row empty-row';
  item.draggable = false;

  item.innerHTML = `
    <span class="drag-handle" style="visibility: hidden;">☰</span>
    <input type="text" class="manage-input" placeholder="Add another..." data-type="${type}">
    <span class="order-num">${orderNum}</span>
  `;

  const input = item.querySelector('.manage-input');
  let hasConverted = false; // Track if already converted

  input.addEventListener('input', (e) => {
    const value = e.target.value;
    // Only convert once, when first character is typed
    if (value.length > 0 && !hasConverted) {
      hasConverted = true;

      // Convert this to a real row
      item.classList.remove('empty-row');
      item.draggable = true;
      item.querySelector('.drag-handle').style.visibility = 'visible';

      // Add remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-row';
      removeBtn.title = 'Remove';
      removeBtn.textContent = '×';
      removeBtn.tabIndex = -1; // Skip in tab order
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.remove();
        updateOrderNumbers();
      });
      item.appendChild(removeBtn);

      // Add drag events
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragend', handleManageDragEnd);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('drop', handleDrop);

      // Add new empty row below
      addEmptyRow(list, parentId, type);
    }
  });

  list.appendChild(item);
}

/**
 * Update order numbers after drag/remove
 */
function updateOrderNumbers() {
  const items = document.querySelectorAll('.reorder-list .reorder-item');
  items.forEach((item, index) => {
    const orderNum = item.querySelector('.order-num');
    if (orderNum) orderNum.textContent = index + 1;
  });
}

/**
 * Handle drag end for manage panel
 */
function handleManageDragEnd(e) {
  const item = e.target.closest('.reorder-item');
  if (item) item.classList.remove('dragging');

  document.querySelectorAll('.reorder-item').forEach(item => {
    item.classList.remove('drag-over');
  });

  updateOrderNumbers();
  draggedItem = null;
}

/**
 * Save all changes and close manage panel
 */
function saveAndCloseManagePanel(parentId) {
  const panel = document.querySelector('.manage-panel');
  if (!panel) {
    closeReorderPanel();
    return;
  }

  const parent = getPersonById(parentId);
  if (!parent) {
    closeReorderPanel();
    return;
  }

  const rows = panel.querySelectorAll('.reorder-item:not(.empty-row)');
  const existingChildren = getChildren(parentId);
  const existingIds = existingChildren.map(c => c.id);
  const processedIds = [];

  rows.forEach((row, index) => {
    const input = row.querySelector('.manage-input');
    const name = input.value.trim();
    const personId = row.dataset.personId;

    if (!name) return; // Skip empty names

    if (personId && existingIds.includes(personId)) {
      // Update existing child
      const person = getPersonById(personId);
      if (person) {
        person.name = name;
        person.birthOrder = index + 1;
      }
      processedIds.push(personId);
    } else if (name) {
      // Add new child
      const parentIds = [parentId];
      if (parent.spouseId) parentIds.push(parent.spouseId);

      const id = generateId(name);
      familyData.people[id] = {
        id,
        name,
        parentIds,
        spouseId: null,
        birthOrder: index + 1
      };
      processedIds.push(id);
    }
  });

  // Remove children that were deleted (existed before but not in processedIds)
  existingIds.forEach(id => {
    if (!processedIds.includes(id)) {
      // Delete this person and their descendants
      const descendants = getDescendants(id);
      descendants.forEach(d => delete familyData.people[d.id]);
      delete familyData.people[id];
    }
  });

  closeReorderPanel();
  renderTree();
}

/**
 * Show unified panel to add/manage siblings
 */
function showAddSiblingForm(personId, card) {
  closeAllPopups();

  const person = getPersonById(personId);
  if (!person) return;

  if (person.parentIds.length === 0) {
    // Root person - manage root siblings
    showManageRootSiblingsPanel();
  } else {
    // Has parents - manage parent's children (siblings)
    showManageChildrenPanel(person.parentIds[0]);
  }
}

/**
 * Show form to add or edit spouse
 */
function showSpouseForm(personId, card, existingSpouse) {
  closeAllPopups();

  const form = document.createElement('form');
  form.className = 'add-form';

  // Add delete button if editing existing spouse
  const deleteBtn = existingSpouse ? `
    <button type="button" class="delete-spouse-btn">Delete Spouse</button>
  ` : '';

  form.innerHTML = `
    <input type="text" name="spouseName" placeholder="Spouse's full name" value="${existingSpouse ? existingSpouse.name : ''}" autofocus>
    <div class="add-form-buttons">
      <button type="button" onclick="closeAllPopups()">Cancel</button>
      <button type="submit">${existingSpouse ? 'Update' : 'Add'}</button>
    </div>
    ${deleteBtn}
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

  // Handle delete spouse
  if (existingSpouse) {
    form.querySelector('.delete-spouse-btn').addEventListener('click', () => {
      deleteSpouse(personId, existingSpouse.id);
      closeAllPopups();
    });
  }

  card.appendChild(form);
  form.querySelector('input').focus();
}

/**
 * Get all descendants of a person (children, grandchildren, etc.)
 */
function getDescendants(personId) {
  const descendants = [];
  const children = getChildren(personId);

  children.forEach(child => {
    descendants.push(child);
    descendants.push(...getDescendants(child.id));
  });

  return descendants;
}

/**
 * Show delete confirmation dialog
 */
function showDeleteConfirm(personId, card) {
  closeAllPopups();

  const person = getPersonById(personId);
  if (!person) return;

  const descendants = getDescendants(personId);
  const spouse = getSpouse(personId);

  // Build warning message
  let warningMsg = '';
  if (descendants.length > 0) {
    const names = descendants.map(d => d.name).join(', ');
    warningMsg = `<p class="delete-warning">This will also delete their entire branch: ${names}</p>`;
  }

  const form = document.createElement('div');
  form.className = 'add-form delete-confirm';
  form.innerHTML = `
    <p class="delete-title">Delete ${person.name}?</p>
    ${warningMsg}
    <div class="add-form-buttons">
      <button type="button" class="cancel-btn" onclick="closeAllPopups()">Cancel</button>
      <button type="button" class="confirm-delete-btn">Delete</button>
    </div>
  `;

  form.querySelector('.confirm-delete-btn').addEventListener('click', () => {
    // Delete all descendants first
    descendants.forEach(d => {
      delete familyData.people[d.id];
    });
    // Then delete the person
    removePerson(personId);
    closeAllPopups();
  });

  card.appendChild(form);
}

/**
 * Show form to edit a person
 */
function showEditForm(personId, card) {
  closeAllPopups();

  const person = getPersonById(personId);
  if (!person) return;

  const form = document.createElement('form');
  form.className = 'add-form';
  form.innerHTML = `
    <input type="text" name="personName" placeholder="Full name" value="${person.name}" autofocus>
    <div class="add-form-buttons">
      <button type="button" onclick="closeAllPopups()">Cancel</button>
      <button type="submit">Save</button>
    </div>
  `;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('input[name="personName"]').value.trim();
    if (name) {
      updatePerson(personId, { name });
      closeAllPopups();
    }
  });

  card.appendChild(form);
  form.querySelector('input').focus();
  form.querySelector('input').select();
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

  // Allow Enter key to close panel
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeReorderPanel();
    }
  });

  // Focus the panel so it can receive key events
  panel.setAttribute('tabindex', '0');
  panel.focus();
}

/**
 * Close the reorder panel
 */
function closeReorderPanel() {
  document.querySelectorAll('.reorder-panel, .reorder-overlay').forEach(el => el.remove());
}

/**
 * Show panel to manage root siblings (add multiple + reorder)
 */
function showManageRootSiblingsPanel() {
  closeReorderPanel();

  const rootPeople = familyData.rootPersonIds
    .map(id => getPersonById(id))
    .filter(p => p)
    .sort((a, b) => (a.birthOrder || 999) - (b.birthOrder || 999));

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'reorder-overlay';
  overlay.addEventListener('click', saveAndCloseRootSiblingsPanel);
  document.body.appendChild(overlay);

  // Create panel
  const panel = document.createElement('div');
  panel.className = 'reorder-panel manage-panel manage-root-panel';

  panel.innerHTML = `
    <h3>Root Generation</h3>
    <p>Add siblings and drag to reorder (oldest first)</p>
    <ul class="reorder-list"></ul>
    <button class="done-btn">Done</button>
  `;

  const list = panel.querySelector('.reorder-list');

  // Add existing root people
  rootPeople.forEach((person, index) => {
    addManageRow(list, person.name, person.id, index + 1);
  });

  // Add empty row for new entry
  addEmptyRow(list, null, 'root');

  // Done button
  panel.querySelector('.done-btn').addEventListener('click', saveAndCloseRootSiblingsPanel);

  // Enter key saves the panel
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveAndCloseRootSiblingsPanel();
    }
  });

  document.body.appendChild(panel);

  // Focus first empty input
  const emptyInput = panel.querySelector('.manage-input:not([data-person-id])');
  if (emptyInput) emptyInput.focus();
}

/**
 * Save root siblings and close panel
 */
function saveAndCloseRootSiblingsPanel() {
  const panel = document.querySelector('.manage-root-panel');
  if (!panel) {
    closeReorderPanel();
    return;
  }

  const rows = panel.querySelectorAll('.reorder-item:not(.empty-row)');
  const existingIds = [...familyData.rootPersonIds];
  const newRootIds = [];

  rows.forEach((row, index) => {
    const input = row.querySelector('.manage-input');
    const name = input.value.trim();
    const personId = row.dataset.personId;

    if (!name) return; // Skip empty names

    if (personId && existingIds.includes(personId)) {
      // Update existing person
      const person = getPersonById(personId);
      if (person) {
        person.name = name;
        person.birthOrder = index + 1;
      }
      newRootIds.push(personId);
    } else if (name) {
      // Add new root person
      const id = generateId(name);
      familyData.people[id] = {
        id,
        name,
        parentIds: [],
        spouseId: null,
        birthOrder: index + 1
      };
      newRootIds.push(id);
    }
  });

  // Remove people that were deleted
  existingIds.forEach(id => {
    if (!newRootIds.includes(id)) {
      const descendants = getDescendants(id);
      descendants.forEach(d => delete familyData.people[d.id]);
      delete familyData.people[id];
    }
  });

  // Update rootPersonIds
  familyData.rootPersonIds = newRootIds;

  closeReorderPanel();
  renderTree();
}

/**
 * Show reorder panel for root siblings
 */
function showRootReorderPanel() {
  closeReorderPanel();

  const rootPeople = familyData.rootPersonIds
    .map(id => getPersonById(id))
    .filter(p => p)
    .sort((a, b) => (a.birthOrder || 999) - (b.birthOrder || 999));

  if (rootPeople.length < 2) return;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'reorder-overlay';
  overlay.addEventListener('click', closeReorderPanel);
  document.body.appendChild(overlay);

  // Create panel
  const panel = document.createElement('div');
  panel.className = 'reorder-panel';

  panel.innerHTML = `
    <h3>Root Generation</h3>
    <p>Drag to reorder by birth (oldest first)</p>
    <ul class="reorder-list"></ul>
    <button class="done-btn" onclick="closeReorderPanel()">Done</button>
  `;

  const list = panel.querySelector('.reorder-list');

  // Add root people to list
  rootPeople.forEach((person, index) => {
    const item = document.createElement('li');
    item.className = 'reorder-item';
    item.draggable = true;
    item.dataset.childId = person.id;
    item.dataset.isRoot = 'true';
    item.innerHTML = `
      <span class="drag-handle">☰</span>
      <span class="child-name">${person.name}</span>
      <span class="order-num">${index + 1}</span>
    `;

    // Drag events
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleRootDragEnd);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);

    list.appendChild(item);
  });

  document.body.appendChild(panel);

  // Allow Enter key to close panel
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeReorderPanel();
    }
  });

  panel.setAttribute('tabindex', '0');
  panel.focus();
}

/**
 * Handle drag end for root siblings (updates rootPersonIds order)
 */
function handleRootDragEnd(e) {
  e.target.closest('.reorder-item').classList.remove('dragging');
  document.querySelectorAll('.reorder-item').forEach(item => {
    item.classList.remove('drag-over');
  });

  // Update birth orders and rootPersonIds based on new positions
  const list = document.querySelector('.reorder-list');
  if (list) {
    const items = list.querySelectorAll('.reorder-item');
    const newRootIds = [];

    items.forEach((item, index) => {
      const personId = item.dataset.childId;
      const person = getPersonById(personId);
      if (person) {
        person.birthOrder = index + 1;
      }
      newRootIds.push(personId);
      item.querySelector('.order-num').textContent = index + 1;
    });

    // Update rootPersonIds array
    familyData.rootPersonIds = newRootIds;

    renderTree();
  }

  draggedItem = null;
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
 * Add a sibling to a person (shares the same parents)
 */
function addSibling(personId, siblingName) {
  const person = getPersonById(personId);
  if (!person || person.parentIds.length === 0) return null;

  // Get existing siblings to determine birth order
  const parentId = person.parentIds[0];
  const existingSiblings = getChildren(parentId);
  const maxOrder = existingSiblings.reduce((max, sib) =>
    Math.max(max, sib.birthOrder || 0), 0);

  return addPerson(siblingName, person.parentIds, null, maxOrder + 1);
}

/**
 * Add a sibling at the root level (no parents)
 */
function addRootSibling(personId, siblingName) {
  // Get existing root siblings to determine birth order
  const rootPeople = familyData.rootPersonIds
    .map(id => getPersonById(id))
    .filter(p => p);
  const maxOrder = rootPeople.reduce((max, p) =>
    Math.max(max, p.birthOrder || 0), 0);

  // Create the person without rendering yet
  const id = generateId(siblingName);
  familyData.people[id] = {
    id,
    name: siblingName,
    parentIds: [],
    spouseId: null,
    birthOrder: maxOrder + 1
  };

  // Add to root person IDs
  familyData.rootPersonIds.push(id);

  // Now render
  renderTree();

  return id;
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
 * Delete a spouse (removes the spouse and unlinks from person)
 */
function deleteSpouse(personId, spouseId) {
  const person = getPersonById(personId);
  const spouse = getPersonById(spouseId);

  if (person) {
    person.spouseId = null;
  }
  if (spouse) {
    spouse.spouseId = null;
    delete familyData.people[spouseId];
  }

  renderTree();
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

  // Remove from rootPersonIds if present
  const rootIndex = familyData.rootPersonIds.indexOf(personId);
  if (rootIndex > -1) {
    familyData.rootPersonIds.splice(rootIndex, 1);
  }

  delete familyData.people[personId];
  renderTree();
  return true;
}

// ============================================
// PROFILE PANEL
// ============================================

let profilePanel = null;
let profileOverlay = null;
let profileHistory = []; // Stack for back navigation

/**
 * Create the profile panel elements (called once on init)
 */
function createProfilePanel() {
  // Create overlay
  profileOverlay = document.createElement('div');
  profileOverlay.className = 'profile-overlay';
  profileOverlay.addEventListener('click', closeProfilePanel);
  document.body.appendChild(profileOverlay);

  // Create panel
  profilePanel = document.createElement('div');
  profilePanel.className = 'profile-panel';
  document.body.appendChild(profilePanel);
}

/**
 * Format a date object for display
 * Handles partial dates (year only, year+month, full date)
 */
function formatDate(dateObj) {
  if (!dateObj || !dateObj.year) return '';

  const { year, month, day } = dateObj;

  if (day && month) {
    return `${month}/${day}/${year}`;
  } else if (month) {
    return `${month}/${year}`;
  } else {
    return `${year}`;
  }
}

/**
 * Calculate age from birth date (and optional death date)
 */
function calculateAge(birthDate, deathDate) {
  if (!birthDate || !birthDate.year) return null;

  const endDate = deathDate && deathDate.year
    ? new Date(deathDate.year, (deathDate.month || 1) - 1, deathDate.day || 1)
    : new Date();

  const birthYear = birthDate.year;
  const birthMonth = birthDate.month || 1;
  const birthDay = birthDate.day || 1;

  let age = endDate.getFullYear() - birthYear;

  // Adjust if birthday hasn't occurred yet this year
  const monthDiff = (endDate.getMonth() + 1) - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDay)) {
    age--;
  }

  // If we only have year, show approximate
  if (!birthDate.month) {
    return `~${age}`;
  }

  return age.toString();
}

/**
 * Open the profile panel for a person
 */
function openProfilePanel(personId) {
  const person = getPersonById(personId);
  if (!person) return;

  const spouse = getSpouse(personId);
  const children = getChildren(personId);
  const parents = person.parentIds.map(id => getPersonById(id)).filter(p => p);
  const siblings = getSiblings(personId);
  const initials = getInitials(person.name);

  // === BUILD BASICS SECTION ===
  // Also called (nicknames) - plain text with commas
  const alsoCalledText = person.alsoCalled && person.alsoCalled.length > 0
    ? person.alsoCalled.join(', ')
    : '';

  // Birth date
  const birthDateStr = formatDate(person.birthDate);

  // Death date (only show row if exists)
  const deathDateStr = formatDate(person.deathDate);
  const isDeceased = deathDateStr !== '';

  // Age calculation
  const age = calculateAge(person.birthDate, person.deathDate);

  // === BUILD FAMILY SECTION ===
  let familyHtml = '';

  // Parents (hide if none)
  if (parents.length > 0) {
    const parentNames = parents.map(p =>
      `<span class="profile-family-name" data-person-id="${p.id}">${p.name}</span>`
    ).join('');
    familyHtml += `
      <div class="profile-family-group">
        <div class="profile-family-label">Parents</div>
        <div class="profile-family-names">${parentNames}</div>
      </div>
    `;
  }

  // Spouse
  if (spouse) {
    familyHtml += `
      <div class="profile-family-group">
        <div class="profile-family-label">Spouse</div>
        <div class="profile-family-names">
          <span class="profile-family-name" data-person-id="${spouse.id}">${spouse.name}</span>
        </div>
      </div>
    `;
  }

  // Siblings
  if (siblings.length > 0) {
    const siblingNames = siblings.map(s =>
      `<span class="profile-family-name" data-person-id="${s.id}">${s.name}</span>`
    ).join('');
    familyHtml += `
      <div class="profile-family-group">
        <div class="profile-family-label">Siblings</div>
        <div class="profile-family-names">${siblingNames}</div>
      </div>
    `;
  }

  // Children
  if (children.length > 0) {
    const childNames = children.map(c =>
      `<span class="profile-family-name" data-person-id="${c.id}">${c.name}</span>`
    ).join('');
    familyHtml += `
      <div class="profile-family-group">
        <div class="profile-family-label">Children</div>
        <div class="profile-family-names">${childNames}</div>
      </div>
    `;
  }

  // If no family connections
  if (!familyHtml) {
    familyHtml = '<p class="profile-empty">No family connections yet</p>';
  }

  // === BUILD ABOUT SECTION ===
  let aboutHtml = '';
  const aboutFields = [
    { key: 'maidenName', label: 'Maiden name', prefix: 'née ' },
    { key: 'occupation', label: 'Occupation' },
    { key: 'education', label: 'Education' },
    { key: 'hobbies', label: 'Hobbies' }
  ];

  // Helper to format field value (handles arrays and strings)
  const formatFieldValue = (value, prefix = '') => {
    if (!value) return '';
    if (Array.isArray(value)) {
      return prefix + value.join(', ');
    }
    return prefix + value;
  };

  // Helper to check if field has value
  const hasValue = (value) => {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  };

  aboutFields.forEach(field => {
    if (hasValue(person[field.key])) {
      const displayValue = formatFieldValue(person[field.key], field.prefix || '');
      aboutHtml += `
        <div class="profile-about-item" data-field="${field.key}">
          <div class="profile-about-label">${field.label}</div>
          <div class="profile-about-value editable" data-field="${field.key}">${displayValue}</div>
        </div>
      `;
    }
  });

  // Notes (plain text like other fields)
  const notesHtml = person.notes
    ? `<div class="profile-about-item" data-field="notes">
        <div class="profile-about-label">Notes</div>
        <div class="profile-about-value editable" data-field="notes">${person.notes}</div>
      </div>`
    : '';

  // Determine if there are missing fields for the "add" hint
  const missingAboutFields = aboutFields.filter(f => !hasValue(person[f.key]));
  const hasMissingFields = missingAboutFields.length > 0 || !person.notes;

  const addHintText = hasMissingFields
    ? 'add additional fields such as hobbies, occupation(s), or any other notes!'
    : '';

  // === BUILD PHOTOS SECTION ===
  const photos = person.photos || [];
  let photosHtml = '';
  if (photos.length > 0) {
    photosHtml = photos.map((photo, index) => `
      <div class="profile-photo-item" data-index="${index}">
        <img src="${photo}" alt="Photo ${index + 1}">
        <button class="profile-photo-remove" data-index="${index}" title="Remove photo">×</button>
      </div>
    `).join('');
  }

  // === BUILD THE PANEL ===
  const hasHistory = profileHistory.length > 0;

  // Build avatar HTML - show photo if exists, otherwise initials
  const hasPhoto = person.photo && person.photo.length > 0;
  const avatarContent = hasPhoto
    ? `<img src="${person.photo}" alt="${person.name}" class="profile-avatar-img">`
    : `<span>${initials}</span>`;

  profilePanel.innerHTML = `
    <div class="profile-header">
      ${hasHistory ? '<button class="profile-back" title="Go back">←</button>' : ''}
      <button class="profile-close" title="Close">×</button>
      <div class="profile-avatar clickable" title="Edit photo">
        ${avatarContent}
        <div class="profile-avatar-overlay">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
      </div>
      <h2 class="profile-name">${person.name}</h2>
    </div>
    <div class="profile-content">
      <!-- BASICS SECTION - Always visible -->
      <div class="profile-section" data-section="basics">
        <h3 class="profile-section-title">Basics</h3>

        <div class="profile-basics-row">
          <span class="profile-basics-label">Also called</span>
          <div class="profile-basics-value editable ${!alsoCalledText ? 'empty' : ''}" data-field="alsoCalled">
            ${alsoCalledText || '—'}
          </div>
        </div>

        <div class="profile-basics-row">
          <span class="profile-basics-label">Born</span>
          <div class="profile-basics-value editable ${!birthDateStr ? 'empty' : ''}" data-field="birthDate">
            ${birthDateStr || '—'}
          </div>
        </div>

        ${isDeceased ? `
        <div class="profile-basics-row">
          <span class="profile-basics-label">Died</span>
          <div class="profile-basics-value editable" data-field="deathDate">
            ${deathDateStr}
          </div>
        </div>
        ` : ''}

        ${age ? `
        <div class="profile-basics-row">
          <span class="profile-basics-label">Age</span>
          <div class="profile-basics-value">
            ${age}${isDeceased ? ' (at death)' : ''}
          </div>
        </div>
        ` : ''}

        <div class="profile-basics-row">
          <span class="profile-basics-label">Location</span>
          <div class="profile-basics-value editable ${!person.location || (Array.isArray(person.location) && person.location.length === 0) ? 'empty' : ''}" data-field="location">
            ${Array.isArray(person.location) ? person.location.join(', ') : (person.location || '—')}
          </div>
        </div>
      </div>

      <!-- FAMILY SECTION -->
      <div class="profile-section" data-section="family">
        <h3 class="profile-section-title">Family</h3>
        ${familyHtml}
      </div>

      <!-- ABOUT SECTION - Only show filled fields -->
      <div class="profile-section" data-section="about">
        <h3 class="profile-section-title">About</h3>
        ${aboutHtml}
        ${notesHtml}
        ${addHintText ? `<div class="profile-add-hint" data-person-id="${personId}">${addHintText}</div>` : ''}
      </div>

      <!-- PHOTOS SECTION -->
      <div class="profile-section" data-section="photos">
        <h3 class="profile-section-title">Photos</h3>
        <div class="profile-photos-grid" data-person-id="${personId}">
          ${photosHtml}
          <div class="profile-photo-add-wrapper">
            <button class="profile-photo-add" title="Add photos">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
            <div class="profile-photo-drop-hint">Drop photos here</div>
          </div>
        </div>
        <input type="file" class="profile-photos-input" accept="image/*" multiple style="display: none;">
      </div>
    </div>
  `;

  // Store current person ID for editing
  profilePanel.dataset.personId = personId;

  // Add event listeners
  profilePanel.querySelector('.profile-close').addEventListener('click', closeProfilePanel);

  // Back button click - go to previous profile
  const backBtn = profilePanel.querySelector('.profile-back');
  if (backBtn) {
    backBtn.addEventListener('click', goBackProfile);
  }

  // Family name clicks - navigate to that person's profile (with history)
  profilePanel.querySelectorAll('.profile-family-name').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.personId;
      navigateToProfile(id);
    });
  });

  // Editable field clicks - enter edit mode
  profilePanel.querySelectorAll('.editable').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const field = el.dataset.field;
      enterEditMode(personId, field, el);
    });
  });

  // Add hint click - show dropdown of fields to add
  const addHint = profilePanel.querySelector('.profile-add-hint');
  if (addHint) {
    addHint.addEventListener('click', (e) => {
      e.stopPropagation();
      showAddFieldDropdown(personId, addHint);
    });
  }

  // Photo modal - click avatar to open photo editor
  const avatar = profilePanel.querySelector('.profile-avatar');
  avatar.addEventListener('click', () => {
    openPhotoModal(personId);
  });

  // Photos section - add photo button
  const addPhotoBtn = profilePanel.querySelector('.profile-photo-add');
  const photosInput = profilePanel.querySelector('.profile-photos-input');
  const photosGrid = profilePanel.querySelector('.profile-photos-grid');

  addPhotoBtn.addEventListener('click', () => {
    photosInput.click();
  });

  // Handle multiple file selection
  photosInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => addPhotoToGallery(personId, file));
    photosInput.value = '';
  });

  // Drag and drop support - on entire panel
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    photosGrid.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only remove class if leaving the panel entirely
    if (!profilePanel.contains(e.relatedTarget)) {
      photosGrid.classList.remove('drag-over');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    photosGrid.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    files.forEach(file => addPhotoToGallery(personId, file));
  };

  profilePanel.addEventListener('dragover', handleDragOver);
  profilePanel.addEventListener('dragleave', handleDragLeave);
  profilePanel.addEventListener('drop', handleDrop);

  // Clean up old paste handler before adding new one
  if (profilePanel._pasteHandler) {
    document.removeEventListener('paste', profilePanel._pasteHandler);
  }

  // Paste support (when profile panel is visible)
  const handlePaste = (e) => {
    // Only handle paste when profile panel is visible
    if (!profilePanel.classList.contains('visible')) return;

    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length > 0) {
      e.preventDefault();
      // Only add one image (the first one) to avoid duplicates
      const file = imageItems[0].getAsFile();
      if (file) addPhotoToGallery(personId, file);
    }
  };

  document.addEventListener('paste', handlePaste);

  // Store handlers for cleanup
  profilePanel._pasteHandler = handlePaste;

  // Photos section - remove buttons
  profilePanel.querySelectorAll('.profile-photo-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      removePhotoFromGallery(personId, index);
    });
  });

  // Photos section - click to view larger
  profilePanel.querySelectorAll('.profile-photo-item img').forEach(img => {
    img.addEventListener('click', () => {
      const index = parseInt(img.parentElement.dataset.index);
      openPhotoViewer(personId, index);
    });
  });

  // Show panel with animation
  requestAnimationFrame(() => {
    profileOverlay.classList.add('visible');
    profilePanel.classList.add('visible');
  });

  // Close on Escape key
  document.addEventListener('keydown', handleProfileEscape);
}

/**
 * Enter edit mode for a field
 */
function enterEditMode(personId, field, element) {
  const person = getPersonById(personId);
  if (!person) return;

  // Field-specific placeholders for expanding list
  const placeholders = {
    alsoCalled: 'Grandpa, Nana, Bobby...',
    location: 'Boston, MA...',
    maidenName: 'Original surname...',
    occupation: 'Software Engineer, Teacher...',
    education: 'MIT, Harvard...',
    hobbies: 'Gardening, reading...'
  };

  // Handle different field types
  if (field === 'birthDate' || field === 'deathDate') {
    showDatePicker(personId, field, element);
  } else if (field === 'notes') {
    showTextareaEditor(personId, field, element);
  } else if (placeholders[field]) {
    // Use expanding list for all fields with placeholders
    showExpandingListEditor(personId, field, element, placeholders[field]);
  } else {
    showTextEditor(personId, field, element);
  }
}

/**
 * Show text input editor for simple fields
 */
function showTextEditor(personId, field, element) {
  const person = getPersonById(personId);
  const currentValue = person[field] || '';

  const container = element.closest('.profile-basics-row, .profile-about-item');
  const originalHtml = element.outerHTML;

  element.outerHTML = `
    <div class="profile-edit-wrapper" data-field="${field}">
      <input type="text" class="profile-edit-input" value="${currentValue}" placeholder="Enter ${field}...">
      <div class="profile-edit-controls">
        <button class="profile-edit-save">Save</button>
        <button class="profile-edit-cancel">Cancel</button>
      </div>
    </div>
  `;

  const wrapper = container.querySelector('.profile-edit-wrapper');
  const input = wrapper.querySelector('input');
  input.focus();
  input.select();

  // Save handler
  wrapper.querySelector('.profile-edit-save').addEventListener('click', () => {
    const newValue = input.value.trim();
    person[field] = newValue || null;
    saveToLocalStorage();
    openProfilePanel(personId); // Refresh panel
  });

  // Cancel handler
  wrapper.querySelector('.profile-edit-cancel').addEventListener('click', () => {
    openProfilePanel(personId); // Refresh panel
  });

  // Enter to save, Escape to cancel
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      wrapper.querySelector('.profile-edit-save').click();
    } else if (e.key === 'Escape') {
      wrapper.querySelector('.profile-edit-cancel').click();
    }
  });
}

/**
 * Show textarea editor for notes
 */
function showTextareaEditor(personId, field, element) {
  const person = getPersonById(personId);
  const currentValue = person[field] || '';

  const container = element.closest('.profile-about-item');

  element.outerHTML = `
    <div class="profile-edit-wrapper" data-field="${field}">
      <textarea class="profile-edit-textarea" placeholder="Add notes...">${currentValue}</textarea>
      <div class="profile-edit-controls">
        <button class="profile-edit-save">Save</button>
        <button class="profile-edit-cancel">Cancel</button>
      </div>
    </div>
  `;

  const wrapper = container.querySelector('.profile-edit-wrapper');
  const textarea = wrapper.querySelector('textarea');
  textarea.focus();

  // Save handler
  wrapper.querySelector('.profile-edit-save').addEventListener('click', () => {
    const newValue = textarea.value.trim();
    person[field] = newValue || null;
    saveToLocalStorage();
    openProfilePanel(personId);
  });

  // Cancel handler
  wrapper.querySelector('.profile-edit-cancel').addEventListener('click', () => {
    openProfilePanel(personId);
  });

  // Escape to cancel (Enter adds new line in textarea)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      wrapper.querySelector('.profile-edit-cancel').click();
    }
  });
}

/**
 * Generate date picker HTML for a single date
 * @param {string} label - Label text
 * @param {object} dateObj - Current date object
 * @param {string} prefix - Prefix for data attributes (birth/death)
 * @param {number} minYear - Minimum year to show (for death date validation)
 */
function generateDatePickerHtml(label, dateObj, prefix, minYear = 1800) {
  const currentDate = dateObj || {};
  const currentYear = new Date().getFullYear();

  // Generate year options (minYear to current)
  let yearOptions = '<option value="">--</option>';
  for (let y = currentYear; y >= minYear; y--) {
    const selected = currentDate.year === y ? 'selected' : '';
    yearOptions += `<option value="${y}" ${selected}>${y}</option>`;
  }

  // Generate month options
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let monthOptions = '<option value="">--</option>';
  months.forEach((m, i) => {
    const selected = currentDate.month === (i + 1) ? 'selected' : '';
    monthOptions += `<option value="${i + 1}" ${selected}>${m}</option>`;
  });

  // Generate day options
  let dayOptions = '<option value="">--</option>';
  for (let d = 1; d <= 31; d++) {
    const selected = currentDate.day === d ? 'selected' : '';
    dayOptions += `<option value="${d}" ${selected}>${d}</option>`;
  }

  return `
    <div class="date-picker-row" data-date="${prefix}">
      <span class="date-picker-label">${label}</span>
      <div class="date-picker-selects">
        <select class="date-picker-select month" data-date="${prefix}">${monthOptions}</select>
        <select class="date-picker-select day" data-date="${prefix}">${dayOptions}</select>
        <select class="date-picker-select year" data-date="${prefix}">${yearOptions}</select>
      </div>
    </div>
  `;
}

/**
 * Show combined date picker for birth and death dates
 */
function showDatePicker(personId, field, element) {
  const person = getPersonById(personId);

  // Find the basics section to replace both Born and Died rows
  const basicsSection = element.closest('.profile-section[data-section="basics"]');
  const bornRow = basicsSection.querySelector('[data-field="birthDate"]')?.closest('.profile-basics-row');

  if (!bornRow) return;

  // Death date minimum year is birth year (if exists), otherwise 1800
  const deathMinYear = person.birthDate?.year || 1800;

  // Create the combined editor
  const editorHtml = `
    <div class="profile-dates-editor">
      ${generateDatePickerHtml('Born', person.birthDate, 'birth', 1800)}
      ${generateDatePickerHtml('Died (optional)', person.deathDate, 'death', deathMinYear)}
      <div class="profile-edit-controls">
        <button class="profile-edit-save">Save</button>
        <button class="profile-edit-cancel">Cancel</button>
      </div>
    </div>
  `;

  // Find and hide the existing rows, insert editor
  const diedRow = basicsSection.querySelector('[data-field="deathDate"]')?.closest('.profile-basics-row');
  const ageRow = basicsSection.querySelector('.profile-basics-row:has(.profile-basics-value:not(.editable))');

  // Hide rows we're replacing
  bornRow.style.display = 'none';
  if (diedRow) diedRow.style.display = 'none';
  if (ageRow) ageRow.style.display = 'none';

  // Insert editor after born row
  bornRow.insertAdjacentHTML('afterend', editorHtml);

  const editor = basicsSection.querySelector('.profile-dates-editor');

  // Get references to selects
  const birthYearSelect = editor.querySelector('.year[data-date="birth"]');
  const deathYearSelect = editor.querySelector('.year[data-date="death"]');
  const deathMonthSelect = editor.querySelector('.month[data-date="death"]');
  const deathDaySelect = editor.querySelector('.day[data-date="death"]');

  // Update death date options based on birth date
  const updateDeathDateOptions = () => {
    const birthYear = birthYearSelect.value ? parseInt(birthYearSelect.value) : null;
    const currentYear = new Date().getFullYear();
    const minYear = birthYear || 1800;

    // Save current death year selection
    const currentDeathYear = deathYearSelect.value;

    // Rebuild death year options
    let yearOptions = '<option value="">--</option>';
    for (let y = currentYear; y >= minYear; y--) {
      const selected = parseInt(currentDeathYear) === y ? 'selected' : '';
      yearOptions += `<option value="${y}" ${selected}>${y}</option>`;
    }
    deathYearSelect.innerHTML = yearOptions;

    // If current death year is now invalid, clear it
    if (currentDeathYear && parseInt(currentDeathYear) < minYear) {
      deathYearSelect.value = '';
      deathMonthSelect.value = '';
      deathDaySelect.value = '';
    }
  };

  // Listen for birth year changes
  birthYearSelect.addEventListener('change', updateDeathDateOptions);

  // Save handler
  editor.querySelector('.profile-edit-save').addEventListener('click', () => {
    // Get birth date values
    const birthYear = editor.querySelector('.year[data-date="birth"]').value;
    const birthMonth = editor.querySelector('.month[data-date="birth"]').value;
    const birthDay = editor.querySelector('.day[data-date="birth"]').value;

    // Get death date values
    const deathYear = editor.querySelector('.year[data-date="death"]').value;
    const deathMonth = editor.querySelector('.month[data-date="death"]').value;
    const deathDay = editor.querySelector('.day[data-date="death"]').value;

    // Save birth date
    if (birthYear) {
      person.birthDate = {
        year: parseInt(birthYear),
        month: birthMonth ? parseInt(birthMonth) : null,
        day: birthDay ? parseInt(birthDay) : null
      };
    } else {
      person.birthDate = null;
    }

    // Save death date
    if (deathYear) {
      person.deathDate = {
        year: parseInt(deathYear),
        month: deathMonth ? parseInt(deathMonth) : null,
        day: deathDay ? parseInt(deathDay) : null
      };
    } else {
      person.deathDate = null;
    }

    saveToLocalStorage();
    openProfilePanel(personId);
  });

  // Cancel handler
  editor.querySelector('.profile-edit-cancel').addEventListener('click', () => {
    openProfilePanel(personId);
  });
}

/**
 * Show expanding list editor for arrays (also called, locations, about fields)
 */
function showExpandingListEditor(personId, field, element, placeholder, container = null) {
  const person = getPersonById(personId);

  // Handle both array and string values
  let currentItems = person[field] || [];
  if (typeof currentItems === 'string') {
    currentItems = currentItems ? [currentItems] : [];
  }

  // Find container - could be basics row or about item
  if (!container) {
    container = element.closest('.profile-basics-row') || element.closest('.profile-about-item');
  }

  // Build list items HTML
  const buildItemsHtml = (items) => {
    let html = '';
    items.forEach((item, index) => {
      html += `
        <div class="expanding-list-item" data-index="${index}">
          <span class="drag-handle">⋮⋮</span>
          <input type="text" class="expanding-list-input" value="${item}" placeholder="${placeholder}">
          <button class="expanding-list-remove" title="Remove" tabindex="-1">×</button>
        </div>
      `;
    });
    // Always add one empty row at the end for new entries
    html += `
      <div class="expanding-list-item new-item">
        <span class="drag-handle">⋮⋮</span>
        <input type="text" class="expanding-list-input" value="" placeholder="${placeholder}">
        <button class="expanding-list-remove" title="Remove" tabindex="-1" style="visibility: hidden;">×</button>
      </div>
    `;
    return html;
  };

  element.outerHTML = `
    <div class="profile-edit-wrapper expanding-list-wrapper" data-field="${field}">
      <div class="expanding-list">
        ${buildItemsHtml(currentItems)}
      </div>
      <div class="profile-edit-controls">
        <button class="profile-edit-save">Save</button>
        <button class="profile-edit-cancel">Cancel</button>
      </div>
    </div>
  `;

  const wrapper = container.querySelector('.profile-edit-wrapper');
  const list = wrapper.querySelector('.expanding-list');

  // Focus the first input (or the new-item input if empty)
  const firstInput = list.querySelector('.expanding-list-input');
  if (firstInput) {
    firstInput.focus();
    if (firstInput.value) {
      firstInput.select();
    }
  }

  // Setup all input handlers
  const setupNewItemHandler = (item) => {
    const input = item.querySelector('.expanding-list-input');
    const removeBtn = item.querySelector('.expanding-list-remove');

    // Only the new-item row should create new rows when filled
    const handleNewItemInput = () => {
      if (input.value.trim() && item.classList.contains('new-item')) {
        // Convert this to a regular row
        item.classList.remove('new-item');
        removeBtn.style.visibility = 'visible';

        // Remove the input listener since it's now a regular row
        input.removeEventListener('input', handleNewItemInput);

        // Add a fresh empty row
        const newRow = document.createElement('div');
        newRow.className = 'expanding-list-item new-item';
        newRow.innerHTML = `
          <span class="drag-handle">⋮⋮</span>
          <input type="text" class="expanding-list-input" value="" placeholder="${placeholder}">
          <button class="expanding-list-remove" title="Remove" tabindex="-1" style="visibility: hidden;">×</button>
        `;
        list.appendChild(newRow);
        setupNewItemHandler(newRow);
      }
    };

    if (item.classList.contains('new-item')) {
      input.addEventListener('input', handleNewItemInput);
    }

    // Remove button handler
    removeBtn.addEventListener('click', () => {
      if (!item.classList.contains('new-item')) {
        item.remove();
      }
    });

    // Enter key moves to next input or saves
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const allInputs = Array.from(list.querySelectorAll('.expanding-list-input'));
        const currentIndex = allInputs.indexOf(input);
        if (currentIndex < allInputs.length - 1) {
          allInputs[currentIndex + 1].focus();
        } else {
          wrapper.querySelector('.profile-edit-save').click();
        }
      } else if (e.key === 'Escape') {
        wrapper.querySelector('.profile-edit-cancel').click();
      }
    });
  };

  // Setup handlers for all initial items
  list.querySelectorAll('.expanding-list-item').forEach(setupNewItemHandler);

  // Save handler - collect all non-empty values
  wrapper.querySelector('.profile-edit-save').addEventListener('click', () => {
    const inputs = list.querySelectorAll('.expanding-list-input');
    const values = Array.from(inputs)
      .map(input => input.value.trim())
      .filter(v => v);

    // Store as array, or null if empty
    person[field] = values.length > 0 ? values : null;
    saveToLocalStorage();
    openProfilePanel(personId);
  });

  // Cancel handler
  wrapper.querySelector('.profile-edit-cancel').addEventListener('click', () => {
    openProfilePanel(personId);
  });
}

/**
 * Show dropdown to add a new field
 */
function showAddFieldDropdown(personId, element) {
  const person = getPersonById(personId);

  // Remove any existing dropdown
  const existing = document.querySelector('.profile-add-dropdown');
  if (existing) existing.remove();

  // Helper to check if field has value
  const hasValue = (value) => {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  };

  // Fields that can be added
  const availableFields = [
    { key: 'maidenName', label: 'Maiden name', placeholder: 'Original surname...' },
    { key: 'occupation', label: 'Occupation', placeholder: 'Software Engineer, Teacher...' },
    { key: 'education', label: 'Education', placeholder: 'MIT, Harvard...' },
    { key: 'hobbies', label: 'Hobbies', placeholder: 'Gardening, reading...' },
    { key: 'notes', label: 'Notes', isTextarea: true }
  ].filter(f => !hasValue(person[f.key]));

  if (availableFields.length === 0) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'profile-add-dropdown';

  availableFields.forEach(field => {
    const btn = document.createElement('button');
    btn.className = 'profile-add-option';
    btn.textContent = field.label;
    btn.addEventListener('click', () => {
      dropdown.remove();

      // Add the new field to the About section
      const aboutSection = profilePanel.querySelector('[data-section="about"]');
      const addHint = aboutSection.querySelector('.profile-add-hint');

      // Create the new about item
      const newItem = document.createElement('div');
      newItem.className = 'profile-about-item';
      newItem.dataset.field = field.key;

      if (field.isTextarea) {
        // Notes uses textarea but displays as plain text
        newItem.innerHTML = `
          <div class="profile-about-label">${field.label}</div>
          <div class="profile-about-value editable" data-field="${field.key}">—</div>
        `;
      } else {
        // Other fields use expanding list
        newItem.innerHTML = `
          <div class="profile-about-label">${field.label}</div>
          <div class="profile-about-value editable" data-field="${field.key}">—</div>
        `;
      }

      // Insert before the add hint
      if (addHint) {
        aboutSection.insertBefore(newItem, addHint);
      } else {
        aboutSection.appendChild(newItem);
      }

      // Initialize person field (as empty array for expanding list, empty string for notes)
      person[field.key] = field.isTextarea ? '' : [];

      // Enter edit mode immediately
      const newElement = newItem.querySelector(`[data-field="${field.key}"]`);
      if (newElement) {
        enterEditMode(personId, field.key, newElement);
      }

      // Update the add hint text
      if (addHint) {
        const aboutFields = [
          { key: 'maidenName', label: 'Maiden name' },
          { key: 'occupation', label: 'Occupation' },
          { key: 'education', label: 'Education' },
          { key: 'hobbies', label: 'Hobbies' }
        ];
        const missingAboutFields = aboutFields.filter(f => !hasValue(person[f.key]));
        const hasMissingFields = missingAboutFields.length > 0 || !person.notes;

        if (hasMissingFields) {
          addHint.textContent = 'add additional fields such as hobbies, occupation(s), or any other notes!';
        } else {
          addHint.remove();
        }
      }
    });
    dropdown.appendChild(btn);
  });

  // Smart positioning - check if there's space below, otherwise go above
  const rect = element.getBoundingClientRect();
  const dropdownHeight = Math.min(availableFields.length * 44, 240); // Max 240px
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  dropdown.style.position = 'fixed';
  dropdown.style.left = `${rect.left}px`;

  if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
    // Position above
    dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    dropdown.style.top = 'auto';
  } else {
    // Position below
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.bottom = 'auto';
  }

  document.body.appendChild(dropdown);

  // Close on click outside
  const closeDropdown = (e) => {
    if (!dropdown.contains(e.target) && e.target !== element) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  };
  setTimeout(() => document.addEventListener('click', closeDropdown), 0);
}

// ============================================
// PHOTO MODAL - LinkedIn-style photo editor
// ============================================

let photoModal = null;
let photoModalState = {
  personId: null,
  originalImage: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0
};

/**
 * Create photo modal elements (called once on init)
 */
function createPhotoModal() {
  photoModal = document.createElement('div');
  photoModal.className = 'photo-modal';
  photoModal.innerHTML = `
    <div class="photo-modal-backdrop"></div>
    <div class="photo-modal-container">
      <div class="photo-modal-header">
        <h2 class="photo-modal-title">Profile photo</h2>
        <button class="photo-modal-close" title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="photo-modal-body">
        <div class="photo-modal-preview">
          <div class="photo-modal-circle">
            <div class="photo-modal-initials"></div>
            <img class="photo-modal-image" src="" alt="" style="display: none;">
          </div>
        </div>
      </div>
      <div class="photo-modal-actions">
        <button class="photo-modal-action" data-action="edit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span>Edit</span>
        </button>
        <button class="photo-modal-action" data-action="change">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span>Change photo</span>
        </button>
        <button class="photo-modal-action photo-modal-action--danger" data-action="delete">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>Delete</span>
        </button>
      </div>
      <input type="file" class="photo-modal-file-input" accept="image/*" style="display: none;">
    </div>

    <!-- Edit/Crop Mode -->
    <div class="photo-modal-editor" style="display: none;">
      <div class="photo-modal-header">
        <h2 class="photo-modal-title">Edit photo</h2>
        <button class="photo-modal-close" title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="photo-editor-body">
        <div class="photo-editor-canvas-wrapper">
          <div class="photo-editor-canvas">
            <img class="photo-editor-image" src="" alt="" draggable="false">
          </div>
          <div class="photo-editor-mask"></div>
        </div>
        <div class="photo-editor-controls">
          <div class="photo-editor-zoom">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
              <path d="M8 11h6"/>
            </svg>
            <input type="range" class="photo-editor-slider" min="1" max="3" step="0.01" value="1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
              <path d="M8 11h6M11 8v6"/>
            </svg>
          </div>
          <p class="photo-editor-hint">Drag to reposition</p>
        </div>
      </div>
      <div class="photo-editor-footer">
        <button class="photo-editor-btn photo-editor-btn--cancel">Cancel</button>
        <button class="photo-editor-btn photo-editor-btn--save">Save photo</button>
      </div>
    </div>
  `;
  document.body.appendChild(photoModal);

  // Set up event listeners
  setupPhotoModalEvents();
}

/**
 * Set up photo modal event listeners
 */
function setupPhotoModalEvents() {
  const backdrop = photoModal.querySelector('.photo-modal-backdrop');
  const closeButtons = photoModal.querySelectorAll('.photo-modal-close');
  const actionButtons = photoModal.querySelectorAll('.photo-modal-action');
  const fileInput = photoModal.querySelector('.photo-modal-file-input');
  const slider = photoModal.querySelector('.photo-editor-slider');
  const editorImage = photoModal.querySelector('.photo-editor-image');
  const cancelBtn = photoModal.querySelector('.photo-editor-btn--cancel');
  const saveBtn = photoModal.querySelector('.photo-editor-btn--save');

  // Close modal
  backdrop.addEventListener('click', closePhotoModal);
  closeButtons.forEach(btn => btn.addEventListener('click', closePhotoModal));

  // Action buttons
  actionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'edit') {
        openPhotoEditor();
      } else if (action === 'change') {
        fileInput.click();
      } else if (action === 'delete') {
        deletePhoto();
      }
    });
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      loadImageForEditing(file);
    }
    fileInput.value = ''; // Reset for same file selection
  });

  // Zoom slider
  slider.addEventListener('input', (e) => {
    photoModalState.zoom = parseFloat(e.target.value);
    updateEditorImage();
  });

  // Drag to pan
  editorImage.addEventListener('mousedown', startDrag);
  editorImage.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('touchmove', handleDrag, { passive: false });
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchend', endDrag);

  // Cancel/Save
  cancelBtn.addEventListener('click', () => {
    showPhotoModalView();
  });
  saveBtn.addEventListener('click', saveEditedPhoto);

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && photoModal.classList.contains('visible')) {
      closePhotoModal();
    }
  });
}

/**
 * Open the photo modal for a person
 */
function openPhotoModal(personId) {
  const person = getPersonById(personId);
  if (!person) return;

  photoModalState.personId = personId;
  photoModalState.zoom = 1;
  photoModalState.panX = 0;
  photoModalState.panY = 0;

  const hasPhoto = person.photo && person.photo.length > 0;
  const initials = getInitials(person.name);

  // Update modal content
  const initialsEl = photoModal.querySelector('.photo-modal-initials');
  const imageEl = photoModal.querySelector('.photo-modal-image');
  const editBtn = photoModal.querySelector('[data-action="edit"]');
  const changeBtn = photoModal.querySelector('[data-action="change"]');
  const deleteBtn = photoModal.querySelector('[data-action="delete"]');

  initialsEl.textContent = initials;

  // Update button label based on whether photo exists
  const changeBtnLabel = changeBtn.querySelector('span');
  changeBtnLabel.textContent = hasPhoto ? 'Change photo' : 'Add photo';

  if (hasPhoto) {
    imageEl.src = person.photo;
    imageEl.style.display = 'block';
    initialsEl.style.display = 'none';
    editBtn.style.display = 'flex';
    deleteBtn.style.display = 'flex';
  } else {
    imageEl.style.display = 'none';
    initialsEl.style.display = 'flex';
    editBtn.style.display = 'none';
    deleteBtn.style.display = 'none';
  }

  // Show modal
  showPhotoModalView();
  photoModal.classList.add('visible');
}

/**
 * Show the view mode (not editing)
 */
function showPhotoModalView() {
  const container = photoModal.querySelector('.photo-modal-container');
  const editor = photoModal.querySelector('.photo-modal-editor');
  container.style.display = 'flex';
  editor.style.display = 'none';
}

/**
 * Open the photo editor
 */
function openPhotoEditor() {
  const person = getPersonById(photoModalState.personId);
  if (!person || !person.photo) return;

  photoModalState.originalImage = person.photo;
  photoModalState.zoom = 1;
  photoModalState.panX = 0;
  photoModalState.panY = 0;

  const editorImage = photoModal.querySelector('.photo-editor-image');
  const slider = photoModal.querySelector('.photo-editor-slider');

  editorImage.src = person.photo;
  slider.value = 1;
  updateEditorImage();

  const container = photoModal.querySelector('.photo-modal-container');
  const editor = photoModal.querySelector('.photo-modal-editor');
  container.style.display = 'none';
  editor.style.display = 'flex';
}

/**
 * Load an image file for editing
 */
function loadImageForEditing(file) {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file.');
    return;
  }

  // Limit file size (10MB for editing, will compress on save)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    alert('Image is too large. Please select an image under 10MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    photoModalState.originalImage = e.target.result;
    photoModalState.zoom = 1;
    photoModalState.panX = 0;
    photoModalState.panY = 0;

    const editorImage = photoModal.querySelector('.photo-editor-image');
    const slider = photoModal.querySelector('.photo-editor-slider');

    editorImage.src = e.target.result;
    slider.value = 1;

    // Wait for image to load to get dimensions
    editorImage.onload = () => {
      updateEditorImage();
    };

    const container = photoModal.querySelector('.photo-modal-container');
    const editor = photoModal.querySelector('.photo-modal-editor');
    container.style.display = 'none';
    editor.style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

/**
 * Update editor image position and scale
 */
function updateEditorImage() {
  const editorImage = photoModal.querySelector('.photo-editor-image');
  const { zoom, panX, panY } = photoModalState;
  editorImage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

/**
 * Start dragging the image
 */
function startDrag(e) {
  if (!photoModal.querySelector('.photo-modal-editor').style.display ||
      photoModal.querySelector('.photo-modal-editor').style.display === 'none') return;

  e.preventDefault();
  photoModalState.isDragging = true;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  photoModalState.dragStartX = clientX - photoModalState.panX;
  photoModalState.dragStartY = clientY - photoModalState.panY;

  document.body.style.cursor = 'grabbing';
}

/**
 * Handle drag movement
 */
function handleDrag(e) {
  if (!photoModalState.isDragging) return;

  e.preventDefault();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  photoModalState.panX = clientX - photoModalState.dragStartX;
  photoModalState.panY = clientY - photoModalState.dragStartY;

  updateEditorImage();
}

/**
 * End dragging
 */
function endDrag() {
  photoModalState.isDragging = false;
  document.body.style.cursor = '';
}

/**
 * Save the edited photo
 */
function saveEditedPhoto() {
  const person = getPersonById(photoModalState.personId);
  if (!person) return;

  const editorImage = photoModal.querySelector('.photo-editor-image');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Output size for the cropped photo
  const outputSize = 400;
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Get the visible area dimensions
  const canvasWrapper = photoModal.querySelector('.photo-editor-canvas');
  const wrapperRect = canvasWrapper.getBoundingClientRect();
  const imgRect = editorImage.getBoundingClientRect();

  // Calculate the crop area
  const { zoom, panX, panY } = photoModalState;
  const naturalWidth = editorImage.naturalWidth;
  const naturalHeight = editorImage.naturalHeight;

  // The displayed image size before zoom
  const displayedWidth = imgRect.width / zoom;
  const displayedHeight = imgRect.height / zoom;

  // Scale factor between natural and displayed
  const scaleX = naturalWidth / displayedWidth;
  const scaleY = naturalHeight / displayedHeight;

  // Center of the crop circle in the wrapper
  const cropCenterX = wrapperRect.width / 2;
  const cropCenterY = wrapperRect.height / 2;

  // Image position relative to wrapper
  const imgX = imgRect.left - wrapperRect.left;
  const imgY = imgRect.top - wrapperRect.top;

  // Crop center in image coordinates
  const imgCropCenterX = (cropCenterX - imgX) / zoom;
  const imgCropCenterY = (cropCenterY - imgY) / zoom;

  // Crop radius in image coordinates (the visible circle is about 240px diameter)
  const cropRadius = 120 / zoom;

  // Source coordinates in natural image
  const srcX = (imgCropCenterX - cropRadius) * scaleX;
  const srcY = (imgCropCenterY - cropRadius) * scaleY;
  const srcSize = cropRadius * 2 * Math.max(scaleX, scaleY);

  // Draw circular crop
  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Draw the cropped portion
  ctx.drawImage(
    editorImage,
    Math.max(0, srcX),
    Math.max(0, srcY),
    srcSize,
    srcSize,
    0,
    0,
    outputSize,
    outputSize
  );

  // Save as JPEG
  person.photo = canvas.toDataURL('image/jpeg', 0.9);

  closePhotoModal();
  renderTree(); // Update tree card avatar
  openProfilePanel(photoModalState.personId);
}

/**
 * Delete the current photo
 */
function deletePhoto() {
  const person = getPersonById(photoModalState.personId);
  if (!person) return;

  delete person.photo;
  closePhotoModal();
  renderTree(); // Update tree card avatar
  openProfilePanel(photoModalState.personId);
}

/**
 * Close the photo modal
 */
function closePhotoModal() {
  photoModal.classList.remove('visible');
  photoModalState.originalImage = null;
  photoModalState.isDragging = false;
}

// ============================================
// PHOTO GALLERY - Multiple photos section
// ============================================

/**
 * Add a photo to the gallery
 */
function addPhotoToGallery(personId, file) {
  const person = getPersonById(personId);
  if (!person) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file.');
    return;
  }

  // Limit file size (5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    alert('Image is too large. Please select an image under 5MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // Resize to max 800px for storage efficiency
      const maxDimension = 800;
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const resizedPhoto = canvas.toDataURL('image/jpeg', 0.85);

      // Initialize photos array if needed
      if (!person.photos) {
        person.photos = [];
      }
      person.photos.push(resizedPhoto);

      // Save and refresh panel
      saveToLocalStorage();
      openProfilePanel(personId);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Remove a photo from the gallery
 */
function removePhotoFromGallery(personId, index) {
  const person = getPersonById(personId);
  if (!person || !person.photos) return;

  person.photos.splice(index, 1);
  saveToLocalStorage();
  openProfilePanel(personId);
}

/**
 * Open photo viewer lightbox
 */
function openPhotoViewer(personId, index) {
  const person = getPersonById(personId);
  if (!person || !person.photos || !person.photos[index]) return;

  // Create lightbox
  const lightbox = document.createElement('div');
  lightbox.className = 'photo-lightbox';
  lightbox.innerHTML = `
    <div class="photo-lightbox-backdrop"></div>
    <div class="photo-lightbox-content">
      <button class="photo-lightbox-close" title="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
      ${person.photos.length > 1 ? `
        <button class="photo-lightbox-nav photo-lightbox-prev" title="Previous">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button class="photo-lightbox-nav photo-lightbox-next" title="Next">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      ` : ''}
      <img class="photo-lightbox-image" src="${person.photos[index]}" alt="Photo">
      <div class="photo-lightbox-counter">${index + 1} / ${person.photos.length}</div>
    </div>
  `;
  document.body.appendChild(lightbox);

  let currentIndex = index;

  const updateImage = () => {
    lightbox.querySelector('.photo-lightbox-image').src = person.photos[currentIndex];
    lightbox.querySelector('.photo-lightbox-counter').textContent = `${currentIndex + 1} / ${person.photos.length}`;
  };

  const closeLightbox = () => {
    lightbox.classList.remove('visible');
    setTimeout(() => lightbox.remove(), 200);
  };

  // Event listeners
  lightbox.querySelector('.photo-lightbox-backdrop').addEventListener('click', closeLightbox);
  lightbox.querySelector('.photo-lightbox-close').addEventListener('click', closeLightbox);

  const prevBtn = lightbox.querySelector('.photo-lightbox-prev');
  const nextBtn = lightbox.querySelector('.photo-lightbox-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + person.photos.length) % person.photos.length;
      updateImage();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % person.photos.length;
      updateImage();
    });
  }

  // Keyboard navigation
  const handleKeydown = (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft' && prevBtn) {
      currentIndex = (currentIndex - 1 + person.photos.length) % person.photos.length;
      updateImage();
    }
    if (e.key === 'ArrowRight' && nextBtn) {
      currentIndex = (currentIndex + 1) % person.photos.length;
      updateImage();
    }
  };
  document.addEventListener('keydown', handleKeydown);

  // Clean up on close
  const originalRemove = lightbox.remove.bind(lightbox);
  lightbox.remove = () => {
    document.removeEventListener('keydown', handleKeydown);
    originalRemove();
  };

  // Animate in
  requestAnimationFrame(() => {
    lightbox.classList.add('visible');
  });
}

/**
 * Navigate to a profile while preserving history (for back navigation)
 */
function navigateToProfile(personId) {
  // Push current profile to history stack
  const currentId = profilePanel.dataset.personId;
  if (currentId) {
    profileHistory.push(currentId);
  }
  openProfilePanel(personId);
}

/**
 * Go back to the previous profile
 */
function goBackProfile() {
  if (profileHistory.length === 0) return;

  const previousId = profileHistory.pop();
  openProfilePanel(previousId);
}

/**
 * Close the profile panel
 */
function closeProfilePanel() {
  if (profileOverlay) profileOverlay.classList.remove('visible');
  if (profilePanel) {
    profilePanel.classList.remove('visible');
    // Clean up paste handler
    if (profilePanel._pasteHandler) {
      document.removeEventListener('paste', profilePanel._pasteHandler);
      profilePanel._pasteHandler = null;
    }
  }
  profileHistory = []; // Clear history when closing
  document.removeEventListener('keydown', handleProfileEscape);
}

/**
 * Handle Escape key to close profile
 */
function handleProfileEscape(e) {
  if (e.key === 'Escape') {
    closeProfilePanel();
  }
}

/**
 * Handle click on person name (opens profile)
 */
function handleNameClick(event) {
  event.stopPropagation();
  const card = event.target.closest('.person-card');
  if (card) {
    const personId = card.dataset.personId;
    openProfilePanel(personId);
  }
}

/**
 * Handle click on spouse name (opens their profile)
 */
function handleSpouseNameClick(event) {
  event.stopPropagation();
  const spouseId = event.target.dataset.spouseId;
  if (spouseId) {
    openProfilePanel(spouseId);
  }
}

/**
 * Handle click on nickname arrow (cycles through nicknames)
 */
function handleNicknameArrowClick(event) {
  event.stopPropagation();
  const arrow = event.target;
  const cycler = arrow.closest('.nickname-cycler');
  if (!cycler) return;

  const personId = cycler.dataset.personId;
  const person = getPersonById(personId);
  if (!person || !person.alsoCalled || person.alsoCalled.length === 0) return;

  const nicknames = person.alsoCalled;
  let currentIndex = parseInt(cycler.dataset.index) || 0;

  // Determine direction
  if (arrow.classList.contains('nickname-next')) {
    currentIndex = (currentIndex + 1) % nicknames.length;
  } else {
    currentIndex = (currentIndex - 1 + nicknames.length) % nicknames.length;
  }

  // Update the display
  cycler.dataset.index = currentIndex;
  const textEl = cycler.querySelector('.nickname-text');
  if (textEl) {
    textEl.textContent = nicknames[currentIndex];
  }
}

// ============================================
// ZOOM & PAN
// ============================================

// Zoom state
let currentZoom = 0.75;
const DEFAULT_ZOOM = 0.75;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

/**
 * Set the zoom level and update UI
 */
function setZoom(level) {
  currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));

  const tree = document.querySelector('.tree');
  const zoomDisplay = document.querySelector('.zoom-level');

  if (tree) {
    tree.style.transform = `scale(${currentZoom})`;
  }

  if (zoomDisplay) {
    // Display relative to default zoom (so default shows as 100%)
    const displayPercent = Math.round((currentZoom / DEFAULT_ZOOM) * 100);
    zoomDisplay.textContent = `${displayPercent}%`;
  }
}

/**
 * Zoom in by one step
 */
function zoomIn() {
  setZoom(currentZoom + ZOOM_STEP);
}

/**
 * Zoom out by one step
 */
function zoomOut() {
  setZoom(currentZoom - ZOOM_STEP);
}

/**
 * Reset zoom to default (75%)
 */
function zoomReset() {
  setZoom(DEFAULT_ZOOM);
}

/**
 * Initialize tree controls (zoom + collapse/expand all)
 */
function initTreeControls() {
  // Zoom controls
  const zoomInBtn = document.querySelector('.zoom-in');
  const zoomOutBtn = document.querySelector('.zoom-out');
  const zoomResetBtn = document.querySelector('.zoom-reset');

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', zoomIn);
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', zoomOut);
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', zoomReset);
  }

  // Collapse/Expand all controls
  const collapseAllBtn = document.querySelector('.collapse-all');
  const expandAllBtn = document.querySelector('.expand-all');

  if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', collapseAll);
  }

  if (expandAllBtn) {
    expandAllBtn.addEventListener('click', expandAll);
  }

  // Nickname toggle control
  const nicknameToggleBtn = document.querySelector('.nickname-toggle');
  if (nicknameToggleBtn) {
    nicknameToggleBtn.addEventListener('click', toggleNicknames);
  }
}

/**
 * Toggle nickname visibility on all cards
 */
function toggleNicknames() {
  const tree = document.querySelector('.tree');
  const btn = document.querySelector('.nickname-toggle');

  if (tree && btn) {
    tree.classList.toggle('hide-nicknames');
    btn.classList.toggle('active');
  }
}

/**
 * Initialize drag-to-scroll on the page
 */
function initDragToScroll() {
  let isDragging = false;
  let startX, startY, scrollLeft, scrollTop;

  document.addEventListener('mousedown', (e) => {
    // Only drag on empty areas, not on interactive elements
    if (e.target.closest('.person-card, .card-dropdown, .add-form, button, .zoom-controls, .legend, .header, input')) {
      return;
    }

    isDragging = true;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    startX = e.clientX;
    startY = e.clientY;
    scrollLeft = window.scrollX;
    scrollTop = window.scrollY;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    window.scrollTo(scrollLeft - dx, scrollTop - dy);
  });
}

// ============================================
// EDITABLE HEADER
// ============================================

/**
 * Initialize editable header fields
 */
function initEditableHeader() {
  const headerTitle = document.querySelector('.header-title');
  const headerTagline = document.querySelector('.header-tagline');

  // Set initial values from familyData
  if (headerTitle) {
    headerTitle.textContent = familyData.title || 'Family Name';
  }
  if (headerTagline) {
    headerTagline.textContent = familyData.tagline || 'Add a tagline...';
  }

  // Set browser tab title
  if (familyData.title) {
    document.title = familyData.title + ' Family Tree';
  }

  // Make fields editable on click
  document.querySelectorAll('.header .editable').forEach(el => {
    el.addEventListener('click', () => startEditingHeader(el));
  });
}

/**
 * Start editing a header field
 */
function startEditingHeader(element) {
  if (element.classList.contains('editing')) return;

  const field = element.dataset.field;
  const currentValue = familyData[field] || '';
  const isTagline = field === 'tagline';

  element.classList.add('editing');

  // Create input or textarea
  const input = document.createElement(isTagline ? 'textarea' : 'input');
  if (!isTagline) input.type = 'text';
  input.value = currentValue;
  input.placeholder = field === 'title' ? 'Family Name' : 'Add a tagline...';

  // For textarea, auto-resize
  if (isTagline) {
    input.rows = 1;
    const autoResize = () => {
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    };
    input.addEventListener('input', autoResize);
    setTimeout(autoResize, 0);
  }

  // Replace text with input
  element.textContent = '';
  element.appendChild(input);

  // Focus and select all
  input.focus();
  input.select();

  // Handle save on blur or Enter (for title) / Cmd+Enter (for tagline)
  const saveEdit = () => {
    const newValue = input.value.trim();
    familyData[field] = newValue;
    saveToLocalStorage();
    element.classList.remove('editing');
    element.textContent = newValue || input.placeholder;

    // Update browser tab title when family name changes
    if (field === 'title' && newValue) {
      document.title = newValue + ' Family Tree';
    }
  };

  // Handle cancel on Escape
  const cancelEdit = () => {
    element.classList.remove('editing');
    element.textContent = currentValue || input.placeholder;
  };

  input.addEventListener('blur', saveEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isTagline) {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Enter' && isTagline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.removeEventListener('blur', saveEdit);
      cancelEdit();
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the app when DOM is ready
 */
async function init() {
  // Load saved data first (handles multi-tree storage)
  await loadAllTreesData();

  createProfilePanel();
  createPhotoModal();
  initEditableHeader();
  initSidebar();
  renderTree();
  initTreeControls();
  initDragToScroll();
  setZoom(DEFAULT_ZOOM); // Apply default zoom

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
