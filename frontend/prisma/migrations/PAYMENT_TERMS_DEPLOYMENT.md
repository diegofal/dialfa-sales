# Payment Terms Deployment Guide

## Overview
This document explains how to deploy the payment terms feature to production.

## Database Migrations

Three SQL migrations have been created in the correct order:

### 1. `20250201000000_add_payment_term_to_clients`
Adds the `payment_term_id` column to the `clients` table (nullable at first).

### 2. `20250201000001_make_client_payment_term_required`
- Sets a default payment term for all existing clients
- Makes the column `NOT NULL`

### 3. `20250201000002_update_sales_orders_payment_terms`
Updates existing sales orders to inherit the payment term from their associated client.

## Deployment Steps

### Local Environment

1. **Apply migrations**:
```bash
cd frontend
npx prisma migrate deploy
```

2. **Regenerate Prisma Client**:
```bash
npx prisma generate
```

3. **Restart the application**

### Railway/Production Environment

1. **Push code to repository**

2. **Railway will automatically**:
   - Detect the new migrations
   - Run `prisma migrate deploy`
   - Rebuild the application

3. **Verify deployment**:
   - Check Railway logs for migration success
   - Test creating a new sales order
   - Verify payment terms are required

## Rollback Plan

If issues occur, you can rollback by:

1. **Revert the database changes** (manual SQL):
```sql
-- Remove NOT NULL constraint
ALTER TABLE clients ALTER COLUMN payment_term_id DROP NOT NULL;

-- Remove payment_term_id column
ALTER TABLE clients DROP COLUMN payment_term_id;
```

2. **Revert code changes** via git

## Testing Checklist

- [ ] Existing clients have a payment term assigned
- [ ] New clients require a payment term
- [ ] Existing sales orders have been updated with client payment terms
- [ ] New sales orders require a payment term selection
- [ ] Payment term is copied to invoices
- [ ] Discounts are calculated based on payment term
- [ ] Client payment term can be changed from sales order form
- [ ] Form validation works correctly

## Notes

- The migrations are idempotent and safe to run multiple times
- No data loss will occur
- The default payment term is automatically selected for existing clients
- All changes are tracked in the activity log
