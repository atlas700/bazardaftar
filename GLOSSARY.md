# BazarDaftar

<a id="afghanistan-agricultural-supply-chain-os"></a>

This glossary defines the business terms used by the pilot's product and
inventory documentation.

## Inventory

**Product**:
A distinct stock identity whose quantities are tracked independently.

**Negative stock**:
An inventory state in which a product's recorded quantity is below zero.

**Outstanding balance**:
The unpaid amount remaining on one invoice or payable.
_Avoid_: separate debt record

**Supplier payable**:
The amount owed to a supplier for goods received and accepted at the approved
purchase price.

**Supplier running balance**:
The sum of a supplier's unpaid receipt payables after payment allocations and
approved reductions, kept separately for AFN and PKR.

**Payment allocation**:
The part of a recorded supplier payment applied to one receipt payable. The
pilot allocates automatically to the oldest unpaid receipts in one debt currency;
one payment can have several allocations.

**Business transaction**:
A recorded purchase, receipt, cash payment, or correction. Recording cash already
paid does not move money through an online payment processor. This differs from
an HTTP request or a database transaction that commits related writes atomically.

**Correction**:
A recorded remedy for an error in business records. In the current pilot, stock
corrections use stock adjustments; posted transaction reversals remain deferred.

**Stock adjustment**:
An owner-approved addition to or deduction from recorded stock, with a reason,
for opening stock, loss, spoilage, or a count correction. It preserves earlier
stock movements and cannot leave stock negative.

**Receipt variance**:
The difference between a purchase order's quantity and the quantity actually
received.

**Dispatch**:
The physical handoff of sold goods from the warehouse.

**Stock unit**:
Kilograms, accurate to one gram, used to compare quantities and stock balances
including purchases entered in equivalent local measures.

**Maan**:
The pilot's local weight measure, defined by the founder as 4.4 kilograms.

**Khorwar**:
The pilot's local weight measure equal to 100 maan, or 440 kilograms.

**Bag**:
A package whose actual weight must be specified; pilot bags may contain 10 or
11 maan, so bag count alone does not establish weight.

**Custom measure**:
A business's named weight measure with an explicitly defined kilogram weight;
past transactions retain the definition used when they were recorded.

**Cash rounding reduction**:
An owner-approved reduction of residual debt, recorded separately from cash paid
and limited cumulatively to 0.99 units of the debt's currency per payable.
