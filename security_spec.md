# Boxing Prediction Market Security Specification

## Data Invariants
1. **Event Integrity**: Only admins can create or update events. Results can only be set once the event is marked as 'finished'.
2. **Bet Accountability**: A user can only place a bet if they have sufficient balance. A bet is immutable once created (except for status updates by system/admin).
3. **Identity Guard**: Users can only read their own bets and transactions. Public profile data is restricted.
4. **Financial Safety**: Transactions (deposits/withdrawals) must be verified. Users cannot modify their own balance directly via client-side writes.

## The "Dirty Dozen" Payloads (Deny List)
1. **Identity Spoofing**: User A trying to place a bet for User B.
2. **Balance Injection**: User A trying to update their own balance field in `/users/{userId}`.
3. **Negative Bet**: Trying to place a bet with a negative amount.
4. **Shadow Event**: Non-admin trying to create an event.
5. **Result Hijack**: Non-admin trying to set the winner of a fight.
6. **Orphaned Bet**: Placing a bet on an event ID that doesn't exist.
7. **Post-Event Bet**: Placing a bet on an event that is already 'finished' or 'live'.
8. **ID Poisoning**: Using a 2KB string as a document ID.
9. **Field Pollution**: Adding `isAdmin: true` to a user profile update.
10. **Transaction Forgery**: Creating a 'completed' deposit transaction without server-side verification.
11. **Balance Drain**: Trying to withdraw more than the available balance (enforced by server logic, but rules should block direct balance edits).
12. **State Jumper**: Changing a bet status from 'pending' to 'won' manually.

## Test Runner (Conceptual logic for rules)
- `isValidId(id)`: Checks size and regex.
- `isValidBet(data)`: Validates selection, positive amount, and link to existing event.
- `isOwner(userId)`: `request.auth.uid == userId`.
