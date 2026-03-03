-- Splitato Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    default_currency TEXT NOT NULL DEFAULT 'USD',
    additional_currency_1 TEXT,
    additional_currency_2 TEXT,
    group_code TEXT NOT NULL UNIQUE,
    pin_code TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick group code lookup
CREATE INDEX IF NOT EXISTS idx_groups_group_code ON groups(group_code);

-- Group members table
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Expenses table
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

-- Expense splits table
CREATE TABLE IF NOT EXISTS expense_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    percentage DECIMAL(5, 2)
);

-- Settlements table
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON settlements(group_id);

-- Row Level Security Policies

-- Groups: Users can view groups they are members of
CREATE POLICY "Users can view their groups" ON groups
    FOR SELECT USING (
        id IN (SELECT group_id FROM group_members WHERE user_id::text = auth.uid()::text)
    );

-- Groups: Only owner can update
CREATE POLICY "Owners can update groups" ON groups
    FOR UPDATE USING (owner_id::text = auth.uid()::text);

-- Group members: Members can view
CREATE POLICY "Members can view group members" ON group_members
    FOR SELECT USING (
        group_id IN (SELECT group_id FROM group_members WHERE user_id::text = auth.uid()::text)
    );

-- Group members: Owner can insert
CREATE POLICY "Owner can add members" ON group_members
    FOR INSERT WITH CHECK (
        group_id IN (SELECT id FROM groups WHERE owner_id::text = auth.uid()::text)
    );

-- Group members: Owner can delete
CREATE POLICY "Owner can remove members" ON group_members
    FOR DELETE USING (
        group_id IN (SELECT id FROM groups WHERE owner_id::text = auth.uid()::text)
    );

-- Expenses: Group members can view
CREATE POLICY "Members can view expenses" ON expenses
    FOR SELECT USING (
        group_id IN (SELECT group_id FROM group_members WHERE user_id::text = auth.uid()::text)
    );

-- Expenses: Group members can insert
CREATE POLICY "Members can add expenses" ON expenses
    FOR INSERT WITH CHECK (
        group_id IN (SELECT group_id FROM group_members WHERE user_id::text = auth.uid()::text)
    );

-- Expenses: Payer and owner can update
CREATE POLICY "Payer and owner can update expenses" ON expenses
    FOR UPDATE USING (
        group_id IN (SELECT id FROM groups WHERE owner_id::text = auth.uid()::text)
        OR payer_id IN (SELECT id FROM group_members WHERE user_id::text = auth.uid()::text)
    );

-- Expenses: Payer and owner can delete
CREATE POLICY "Payer and owner can delete expenses" ON expenses
    FOR DELETE USING (
        group_id IN (SELECT id FROM groups WHERE owner_id::text = auth.uid()::text)
        OR payer_id IN (SELECT id FROM group_members WHERE user_id::text = auth.uid()::text)
    );

-- Expense splits: Members can view
CREATE POLICY "Members can view expense splits" ON expense_splits
    FOR SELECT USING (
        expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id::text = auth.uid()::text))
    );

-- Expense splits: Members can insert
CREATE POLICY "Members can add expense splits" ON expense_splits
    FOR INSERT WITH CHECK (
        expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id::text = auth.uid()::text))
    );

-- Expense splits: Members can update
CREATE POLICY "Members can update expense splits" ON expense_splits
    FOR UPDATE USING (
        expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id::text = auth.uid()::text))
    );

-- Expense splits: Members can delete
CREATE POLICY "Members can delete expense splits" ON expense_splits
    FOR DELETE USING (
        expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id::text = auth.uid()::text))
    );

-- Settlements: Members can view
CREATE POLICY "Members can view settlements" ON settlements
    FOR SELECT USING (
        group_id IN (SELECT group_id FROM group_members WHERE user_id::text = auth.uid()::text)
    );

-- Settlements: Members can insert
CREATE POLICY "Members can add settlements" ON settlements
    FOR INSERT WITH CHECK (
        group_id IN (SELECT group_id FROM group_members WHERE user_id::text = auth.uid()::text)
    );

-- Storage: Create bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for receipts
CREATE POLICY "Anyone can view receipts" ON storage.objects
    FOR SELECT USING (bucket_id = 'receipts');

CREATE POLICY "Authenticated users can upload receipts" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');
