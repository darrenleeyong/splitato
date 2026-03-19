-- 1. INITIAL SETUP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE TABLES (Using IF NOT EXISTS so it's safe to re-run)
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    default_currency TEXT NOT NULL DEFAULT 'USD',
    additional_currency_1 TEXT,
    additional_currency_2 TEXT,
    group_code TEXT NOT NULL UNIQUE,
    pin_code TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    simplify_debts BOOLEAN DEFAULT false,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, 
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    description TEXT NOT NULL,
    date DATE NOT NULL,
    receipt_url TEXT,
    split_type TEXT NOT NULL DEFAULT 'even' CHECK (split_type IN ('even', 'percentage', 'specific')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    percentage DECIMAL(5, 2)
);

CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'SGD',
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SAFE POLICY CLEANUP (Now that tables definitely exist)
DO $$ 
BEGIN
    -- Groups
    DROP POLICY IF EXISTS "Anyone can view groups" ON groups;
    DROP POLICY IF EXISTS "Anyone can create groups" ON groups;
    DROP POLICY IF EXISTS "Anyone can update groups" ON groups;
    -- Members
    DROP POLICY IF EXISTS "Anyone can view group members" ON group_members;
    DROP POLICY IF EXISTS "Anyone can add members" ON group_members;
    -- Expenses
    DROP POLICY IF EXISTS "Anyone can view expenses" ON expenses;
    DROP POLICY IF EXISTS "Anyone can add expenses" ON expenses;
    DROP POLICY IF EXISTS "Anyone can update expenses" ON expenses;
    DROP POLICY IF EXISTS "Anyone can delete expenses" ON expenses;
    -- Splits
    DROP POLICY IF EXISTS "Anyone can view expense splits" ON expense_splits;
    DROP POLICY IF EXISTS "Anyone can add expense splits" ON expense_splits;
    -- Settlements
    DROP POLICY IF EXISTS "Anyone can view settlements" ON settlements;
    DROP POLICY IF EXISTS "Anyone can add settlements" ON settlements;
    DROP POLICY IF EXISTS "Anyone can delete settlements" ON settlements;
    -- Storage
    DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;
END $$;

-- 4. ENABLE RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- 5. RE-APPLY POLICIES
CREATE POLICY "Anyone can view groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Anyone can create groups" ON groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update groups" ON groups FOR UPDATE USING (true);
CREATE POLICY "Only owner can delete groups" ON groups FOR DELETE USING (owner_id = auth.uid()::text);

CREATE POLICY "Anyone can view group members" ON group_members FOR SELECT USING (true);
CREATE POLICY "Anyone can add members" ON group_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update members" ON group_members FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete members" ON group_members FOR DELETE USING (true);

CREATE POLICY "Anyone can view expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Anyone can add expenses" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update expenses" ON expenses FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete expenses" ON expenses FOR DELETE USING (true);

CREATE POLICY "Anyone can view expense splits" ON expense_splits FOR SELECT USING (true);
CREATE POLICY "Anyone can add expense splits" ON expense_splits FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update expense splits" ON expense_splits FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete expense splits" ON expense_splits FOR DELETE USING (true);

CREATE POLICY "Anyone can view settlements" ON settlements FOR SELECT USING (true);
CREATE POLICY "Anyone can add settlements" ON settlements FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete settlements" ON settlements FOR DELETE USING (true);

-- 6. STORAGE BUCKETS & POLICIES
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view receipts" ON storage.objects
    FOR SELECT USING (bucket_id = 'receipts');

CREATE POLICY "Anyone can upload receipts" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Anyone can view avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can upload avatars" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can update avatars" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can delete avatars" ON storage.objects
    FOR DELETE USING (bucket_id = 'avatars');