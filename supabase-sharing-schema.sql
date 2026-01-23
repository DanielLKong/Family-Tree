-- ============================================
-- SHARING SCHEMA FOR FAMILY TREE
-- Run this in Supabase SQL Editor
-- ============================================

-- Create the tree_shares table
CREATE TABLE IF NOT EXISTS tree_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,

  -- Share link token (random string for URL)
  share_token TEXT UNIQUE NOT NULL,

  -- Permission level: 'viewer' or 'editor'
  permission TEXT NOT NULL CHECK (permission IN ('viewer', 'editor')),

  -- Who created this share link
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional: future features
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tree_shares_token ON tree_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_tree_shares_tree ON tree_shares(tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_shares_created_by ON tree_shares(created_by);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on the table
ALTER TABLE tree_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read shares (needed to validate tokens for anonymous access)
CREATE POLICY "Anyone can read shares"
  ON tree_shares
  FOR SELECT
  USING (true);

-- Policy: Tree owners can create shares
CREATE POLICY "Tree owners can create shares"
  ON tree_shares
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trees
      WHERE trees.id = tree_id
      AND trees.user_id = auth.uid()
    )
  );

-- Policy: Share creators can delete their shares
CREATE POLICY "Creators can delete their shares"
  ON tree_shares
  FOR DELETE
  USING (created_by = auth.uid());

-- Policy: Share creators can update their shares (e.g., disable)
CREATE POLICY "Creators can update their shares"
  ON tree_shares
  FOR UPDATE
  USING (created_by = auth.uid());

-- ============================================
-- UPDATE TREES TABLE RLS FOR EDITOR ACCESS
-- ============================================

-- Policy: Allow editors to update trees they have edit access to
-- (This requires a more permissive update policy on trees)
CREATE POLICY "Editors can update shared trees"
  ON trees
  FOR UPDATE
  USING (
    -- Owner can always update
    user_id = auth.uid()
    OR
    -- Check if there's an active editor share for this tree
    EXISTS (
      SELECT 1 FROM tree_shares
      WHERE tree_shares.tree_id = trees.id
      AND tree_shares.permission = 'editor'
      AND tree_shares.is_active = true
    )
  );

-- Policy: Allow anyone to read trees that have active shares
-- (Anonymous users need to be able to read shared trees)
CREATE POLICY "Anyone can read shared trees"
  ON trees
  FOR SELECT
  USING (
    -- Owner can always read
    user_id = auth.uid()
    OR
    -- Anyone can read if there's an active share
    EXISTS (
      SELECT 1 FROM tree_shares
      WHERE tree_shares.tree_id = trees.id
      AND tree_shares.is_active = true
    )
  );
