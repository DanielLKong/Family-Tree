/*
  Supabase Configuration

  Handles authentication and will later handle cloud data storage.
*/

// Supabase credentials (safe to expose - these are public keys)
const SUPABASE_URL = 'https://geesuocihtbaeadrxhbk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZXN1b2NpaHRiYWVhZHJ4aGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mzg4NjIsImV4cCI6MjA4NDAxNDg2Mn0.wM9LGMVFLxYksVYEZsMZjT-QlrcLYEpCtVeeHwM7OKM';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Current user state
let currentUser = null;
let isProcessingSignIn = false; // Prevent duplicate sign-in processing

// ============================================
// AUTH STATE MANAGEMENT
// ============================================

/**
 * Initialize auth - check if user is already logged in
 */
async function initAuth() {
  // Check current session
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    currentUser = session.user;
    updateAuthUI();
  }

  // Listen for auth changes (login, logout, token refresh)
  // IMPORTANT: Don't await inside this callback - it can cause deadlocks
  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();

    if (event === 'SIGNED_IN') {
      console.log('User signed in:', currentUser.email);
      closeAuthModal();

      // Prevent duplicate processing (SIGNED_IN fires multiple times during OAuth)
      if (isProcessingSignIn) {
        console.log('Already processing sign-in, skipping duplicate event');
        return;
      }
      isProcessingSignIn = true;

      // Use setTimeout to break out of the auth callback before doing async work
      setTimeout(async () => {
        console.log('Starting post-signin tasks...');

        // Always migrate localStorage trees to cloud (merges with existing)
        await migrateLocalStorageToCloud();

        // Clear localStorage after migration so guest mode starts fresh
        localStorage.removeItem('familyTreeData');

        // Reload the app with cloud data (app.js handles this)
        if (typeof loadAllTreesData === 'function') {
          await loadAllTreesData();
          console.log('After loadAllTreesData - allTreesData:', allTreesData);
          console.log('After loadAllTreesData - tree count:', Object.keys(allTreesData?.trees || {}).length);
          if (typeof renderTreesList === 'function') renderTreesList();
          if (typeof initEditableHeader === 'function') initEditableHeader();
          if (typeof renderTree === 'function') renderTree();
        }

        // Reset flag after processing complete
        isProcessingSignIn = false;
      }, 0);
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');

      // Clear localStorage so guest starts fresh (cloud data is safe)
      localStorage.removeItem('familyTreeData');

      // Reload page for clean state - simpler than resetting all in-memory data
      window.location.reload();
    }
  });
}

/**
 * Update UI based on auth state
 */
function updateAuthUI() {
  const accountBtnText = document.getElementById('account-btn-text');
  const accountBtn = document.getElementById('account-btn');
  const dropdownName = document.getElementById('account-dropdown-name');
  const dropdownEmail = document.getElementById('account-dropdown-email');

  if (currentUser) {
    // Get display name from user metadata or email
    const fullName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
    const displayName = fullName.split(' ')[0]; // First name only for button

    accountBtnText.textContent = displayName;
    accountBtn.classList.add('signed-in');

    // Update dropdown
    dropdownName.textContent = fullName;
    dropdownEmail.textContent = currentUser.email;
  } else {
    accountBtnText.textContent = 'Sign In';
    accountBtn.classList.remove('signed-in');
    dropdownName.textContent = '';
    dropdownEmail.textContent = '';
  }
}

/**
 * Toggle account dropdown
 */
function toggleAccountDropdown() {
  const dropdown = document.getElementById('account-dropdown');
  dropdown.classList.toggle('active');
}

/**
 * Close account dropdown
 */
function closeAccountDropdown() {
  const dropdown = document.getElementById('account-dropdown');
  dropdown.classList.remove('active');
}

// ============================================
// AUTH MODAL
// ============================================

let authMode = 'signin'; // 'signin' or 'signup'

/**
 * Open the auth modal
 */
function openAuthModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  overlay.classList.add('active');
  document.getElementById('auth-email').focus();
}

/**
 * Close the auth modal
 */
function closeAuthModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  overlay.classList.remove('active');
  // Reset form
  document.getElementById('auth-form').reset();
  document.getElementById('auth-password').style.display = '';
}

/**
 * Toggle between sign in and sign up modes
 */
function toggleAuthMode() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';

  const title = document.getElementById('auth-modal-title');
  const subtitle = document.getElementById('auth-modal-subtitle');
  const submitBtn = document.getElementById('auth-submit-btn');
  const togglePrompt = document.getElementById('auth-toggle-prompt');
  const toggleBtn = document.getElementById('auth-toggle-btn');

  if (authMode === 'signup') {
    title.textContent = 'Create Account';
    subtitle.textContent = 'Save your trees to the cloud';
    submitBtn.textContent = 'Create Account';
    togglePrompt.textContent = 'Already have an account?';
    toggleBtn.textContent = 'Sign In';
  } else {
    title.textContent = 'Sign In';
    subtitle.textContent = 'Access your trees from any device';
    submitBtn.textContent = 'Sign In';
    togglePrompt.textContent = "Don't have an account?";
    toggleBtn.textContent = 'Sign Up';
  }
}

// ============================================
// AUTH ACTIONS
// ============================================

/**
 * Sign up with email and password
 */
async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert(error.message);
    return false;
  }

  // Check if email confirmation is required
  if (data.user && !data.session) {
    alert('Check your email for a confirmation link!');
  }

  return true;
}

/**
 * Sign in with email and password
 */
async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert(error.message);
    return false;
  }

  return true;
}

/**
 * Send magic link (passwordless login)
 */
async function sendMagicLink(email) {
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });

  if (error) {
    alert(error.message);
    return false;
  }

  alert('Check your email for a magic link!');
  return true;
}

/**
 * Sign in with Google
 */
async function signInWithGoogle() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    alert(error.message);
    return false;
  }

  return true;
}

/**
 * Sign out
 */
async function signOut() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert(error.message);
    return false;
  }

  return true;
}

// ============================================
// CLOUD DATA STORAGE
// ============================================

/**
 * Load all trees from Supabase for current user
 * Returns: { trees: {...}, activeTreeId: "..." } or null if none
 */
async function loadTreesFromCloud() {
  if (!currentUser) return null;

  console.log('Loading trees from cloud for user:', currentUser.id);

  const { data, error } = await supabaseClient
    .from('trees')
    .select('*')
    .eq('user_id', currentUser.id);

  if (error) {
    console.error('Error loading trees:', error);
    return null;
  }

  console.log('Cloud trees loaded:', data?.length || 0, 'trees');

  if (!data || data.length === 0) {
    return null; // No trees in cloud yet
  }

  // Convert array of rows to our trees object format
  const trees = {};
  data.forEach(row => {
    console.log('  - Tree:', row.id, row.title);
    trees[row.id] = {
      id: row.id,
      title: row.title,
      tagline: row.tagline,
      ...row.data, // rootPersonIds, people, collapsedIds
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });

  return {
    version: 2,
    activeTreeId: data[0].id, // Default to first tree
    trees
  };
}

/**
 * Save a single tree to Supabase (insert or update)
 */
async function saveTreeToCloud(tree) {
  if (!currentUser) return false;

  console.log('saveTreeToCloud called for:', tree.id, tree.title);
  console.log('Current user ID:', currentUser.id);
  console.log('Current user ID type:', typeof currentUser.id);

  const treeData = {
    id: tree.id,
    user_id: currentUser.id,
    title: tree.title,
    tagline: tree.tagline || '',
    data: {
      rootPersonIds: tree.rootPersonIds || [],
      collapsedIds: tree.collapsedIds || [],
      people: tree.people || {}
    },
    updated_at: new Date().toISOString()
  };

  // Try insert first, if conflict then update
  console.log('Attempting insert with data:', JSON.stringify(treeData, null, 2));

  let insertError;
  try {
    console.log('About to call supabase upsert via fetch...');

    // Get the current session for the auth token
    const { data: { session } } = await supabaseClient.auth.getSession();
    const accessToken = session?.access_token;

    console.log('Access token exists:', !!accessToken);

    // Use fetch directly with upsert (on conflict, update)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/trees?on_conflict=id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(treeData)
    });

    console.log('Fetch response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fetch error response:', errorText);
      insertError = { message: errorText, code: response.status };
    }
  } catch (e) {
    console.error('Insert exception:', e);
    insertError = { message: e.message };
  }

  if (insertError) {
    console.error('Error saving tree:', insertError);
    return false;
  }

  console.log('saveTreeToCloud success for:', tree.id);
  return true;
}

/**
 * Delete a tree from Supabase
 */
async function deleteTreeFromCloud(treeId) {
  if (!currentUser) return false;

  const { error } = await supabaseClient
    .from('trees')
    .delete()
    .eq('id', treeId)
    .eq('user_id', currentUser.id);

  if (error) {
    console.error('Error deleting tree:', error);
    return false;
  }

  return true;
}

/**
 * Migrate localStorage trees to cloud on sign-in
 * Uses upsert so duplicate calls don't create duplicate trees
 */
async function migrateLocalStorageToCloud() {
  const localData = localStorage.getItem('familyTreeData');
  if (!localData) {
    console.log('No localStorage data to migrate');
    return;
  }

  try {
    const parsed = JSON.parse(localData);
    if (!parsed.trees || Object.keys(parsed.trees).length === 0) {
      console.log('No trees in localStorage');
      return;
    }

    // Check if tree is just the empty default (no people, default title)
    const trees = Object.values(parsed.trees);
    const hasRealData = trees.some(tree =>
      Object.keys(tree.people || {}).length > 0 ||
      (tree.title && tree.title !== 'Family Name')
    );

    if (!hasRealData) {
      console.log('No real data to migrate (empty default tree)');
      return;
    }

    console.log('Migrating localStorage trees to cloud...');

    for (const tree of trees) {
      // Skip empty default trees
      if (Object.keys(tree.people || {}).length === 0 && tree.title === 'Family Name') {
        console.log('  - Skipping empty default tree:', tree.id);
        continue;
      }

      // Keep the original ID - upsert will handle duplicates
      console.log('  - Migrating tree:', tree.title, 'ID:', tree.id);
      const success = await saveTreeToCloud(tree);
      console.log('    Save result:', success ? 'success' : 'FAILED');
    }

    console.log('Migration complete!');
  } catch (e) {
    console.error('Error migrating localStorage:', e);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function initAuthListeners() {
  // Account button - open modal or show dropdown
  document.getElementById('account-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentUser) {
      toggleAccountDropdown();
    } else {
      openAuthModal();
    }
  });

  // Close modal
  document.getElementById('auth-modal-close').addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'auth-modal-overlay') {
      closeAuthModal();
    }
  });

  // Toggle sign in / sign up
  document.getElementById('auth-toggle-btn').addEventListener('click', toggleAuthMode);

  // Form submission (sign in or sign up with password)
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit-btn');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';

    if (authMode === 'signup') {
      await signUp(email, password);
    } else {
      await signIn(email, password);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = authMode === 'signup' ? 'Create Account' : 'Sign In';
  });

  // Magic link button
  document.getElementById('auth-magic-link-btn').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;

    if (!email) {
      alert('Please enter your email address first');
      document.getElementById('auth-email').focus();
      return;
    }

    const btn = document.getElementById('auth-magic-link-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    await sendMagicLink(email);

    btn.disabled = false;
    btn.textContent = 'Send Magic Link';
  });

  // Google sign-in button
  document.getElementById('auth-google-btn').addEventListener('click', async () => {
    const btn = document.getElementById('auth-google-btn');
    btn.disabled = true;
    await signInWithGoogle();
    btn.disabled = false;
  });

  // Sign out button in dropdown
  document.getElementById('account-signout-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    // Don't close dropdown until sign out completes
    signOut().then(() => {
      closeAccountDropdown();
    }).catch((err) => {
      console.error('Sign out failed:', err);
      closeAccountDropdown();
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('account-dropdown');
    const accountBtn = document.getElementById('account-btn');
    if (!dropdown.contains(e.target) && !accountBtn.contains(e.target)) {
      closeAccountDropdown();
    }
  });

  // Escape key to close modal and dropdown
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthModal();
      closeAccountDropdown();
    }
  });
}

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initAuthListeners();
});
