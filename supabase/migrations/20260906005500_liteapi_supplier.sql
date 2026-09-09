-- LiteAPI (Nuitée Connect) as a hotel supplier.
--
-- Chosen in docs/hotel-provider-audit.md and probed against a real sandbox key before any code was
-- written, which is the opposite of how the Duffel adapter happened. All five methods of our
-- supplier contract were verified end to end in the sandbox: property lookup by id, rates, a
-- prebook that reports both price and cancellation drift, a booking that returns a confirmation
-- code, and a cancellation that reports the refunded amount.
--
-- That last one decided the ranking. Duffel's cancel returns a status and nothing else, so the
-- fifth method could never be honest about what came back. LiteAPI returns `refund_amount` and
-- `cancellation_fee`.
--
-- `alter type ... add value` cannot be used in the same transaction that adds it, so nothing here
-- references the new value. The adapter, the reliability weight and the env switch live in code.
alter type public.hotel_supplier add value if not exists 'liteapi';

comment on type public.hotel_supplier is
  'Mirror of HOTEL_SUPPLIERS in @guideless/types. duffel and liteapi have adapters; expedia and hotelbeds are reserved names with no implementation behind them; manual is the deterministic mock and hand-contracted inventory.';
