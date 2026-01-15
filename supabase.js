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
  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();

    if (event === 'SIGNED_IN') {
      console.log('User signed in:', currentUser.email);
      closeAuthModal();
      // TODO: Migrate localStorage data to cloud
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
    }
  });
}

/**
 * Update UI based on auth state
 */
function updateAuthUI() {
  const accountBtnText = document.getElementById('account-btn-text');
  const accountBtn = document.getElementById('account-btn');

  if (currentUser) {
    // Show user email or "Account"
    const displayName = currentUser.email.split('@')[0];
    accountBtnText.textContent = displayName;
    accountBtn.classList.add('signed-in');
  } else {
    accountBtnText.textContent = 'Sign In';
    accountBtn.classList.remove('signed-in');
  }
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
// EVENT LISTENERS
// ============================================

function initAuthListeners() {
  // Account button - open modal or show account menu
  document.getElementById('account-btn').addEventListener('click', () => {
    if (currentUser) {
      // Show simple confirm to sign out
      if (confirm(`Signed in as ${currentUser.email}\n\nSign out?`)) {
        signOut();
      }
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

  // Escape key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthModal();
    }
  });
}

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initAuthListeners();
});
