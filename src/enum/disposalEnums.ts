/**
 * Mirrors TulipsHRM.AssetManagement.Domain disposal enums — keep in sync with
 * the backend. Persisted ints; never renumber.
 */

/** The nine §12 disposal methods. */
export enum DisposalMethodEnum {
  Sale = 1,
  Scrap = 2,
  Donation = 3,
  Loss = 4,
  Theft = 5,
  ReturnToSupplier = 6,
  TradeIn = 7,
  Destruction = 8,
  Recycling = 9,
}

/**
 * Disposal-request lifecycle. Executed is terminal and so is the Disposed asset
 * it produces — there is no un-dispose. The one-active-request filtered index
 * references Requested = 1 and Approved = 2; never renumber.
 */
export enum DisposalRequestStatusEnum {
  Requested = 1,
  Approved = 2,
  Executed = 3,
  Rejected = 4,
  Cancelled = 5,
}

export const DISPOSAL_METHOD_LABELS: Record<number, string> = {
  [DisposalMethodEnum.Sale]: 'Sale',
  [DisposalMethodEnum.Scrap]: 'Scrap',
  [DisposalMethodEnum.Donation]: 'Donation',
  [DisposalMethodEnum.Loss]: 'Loss',
  [DisposalMethodEnum.Theft]: 'Theft',
  [DisposalMethodEnum.ReturnToSupplier]: 'Return To Supplier',
  [DisposalMethodEnum.TradeIn]: 'Trade In',
  [DisposalMethodEnum.Destruction]: 'Destruction',
  [DisposalMethodEnum.Recycling]: 'Recycling',
};

/** Loss and Theft red — they are the two that describe an asset nobody can produce. */
export const DISPOSAL_METHOD_BADGE_CLASSES: Record<number, string> = {
  [DisposalMethodEnum.Sale]: 'bg-green-100 text-green-800',
  [DisposalMethodEnum.Scrap]: 'bg-gray-100 text-gray-800',
  [DisposalMethodEnum.Donation]: 'bg-blue-50 text-blue-800',
  [DisposalMethodEnum.Loss]: 'bg-red-100 text-red-800',
  [DisposalMethodEnum.Theft]: 'bg-red-100 text-red-800',
  [DisposalMethodEnum.ReturnToSupplier]: 'bg-purple-100 text-purple-800',
  [DisposalMethodEnum.TradeIn]: 'bg-green-100 text-green-800',
  [DisposalMethodEnum.Destruction]: 'bg-amber-100 text-amber-800',
  [DisposalMethodEnum.Recycling]: 'bg-teal-100 text-teal-800',
};

export const DISPOSAL_REQUEST_STATUS_LABELS: Record<number, string> = {
  [DisposalRequestStatusEnum.Requested]: 'Requested',
  [DisposalRequestStatusEnum.Approved]: 'Approved',
  [DisposalRequestStatusEnum.Executed]: 'Executed',
  [DisposalRequestStatusEnum.Rejected]: 'Rejected',
  [DisposalRequestStatusEnum.Cancelled]: 'Cancelled',
};

export const DISPOSAL_REQUEST_STATUS_BADGE_CLASSES: Record<number, string> = {
  [DisposalRequestStatusEnum.Requested]: 'bg-amber-100 text-amber-800',
  [DisposalRequestStatusEnum.Approved]: 'bg-blue-50 text-blue-800',
  [DisposalRequestStatusEnum.Executed]: 'bg-green-100 text-green-800',
  [DisposalRequestStatusEnum.Rejected]: 'bg-red-100 text-red-800',
  [DisposalRequestStatusEnum.Cancelled]: 'bg-gray-100 text-gray-800',
};

/**
 * The two methods that describe an asset nobody can produce. Execution accepts
 * a Missing custody status ONLY for these, and clears it to Unassigned as it
 * goes — the one sanctioned Missing → Unassigned write in the module (phase
 * design §2.1). Used for the client-side Execute pre-flight.
 */
export const MISSING_PERMITTED_METHODS: DisposalMethodEnum[] = [
  DisposalMethodEnum.Loss,
  DisposalMethodEnum.Theft,
];

/**
 * Methods where the money must be real by execution time — the API 400s
 * without actual proceeds. Enforced client-side too so the largest form in the
 * module is not submitted just to be told (design §4.1 guard 7).
 */
export const PROCEEDS_REQUIRED_METHODS: DisposalMethodEnum[] = [
  DisposalMethodEnum.Sale,
  DisposalMethodEnum.TradeIn,
];

/**
 * What each method means, and which of them a Missing asset accepts. Surfaced
 * under the method picker — the choice is not cosmetic: it decides whether
 * proceeds become mandatory and whether an unrecoverable asset can ever leave
 * the register.
 */
export const DISPOSAL_METHOD_HINTS: Record<number, string> = {
  [DisposalMethodEnum.Sale]:
    'Sold to a buyer — the actual proceeds and a currency are required at execution.',
  [DisposalMethodEnum.Scrap]:
    'Written off as scrap through a scrap merchant; any scrap value is optional.',
  [DisposalMethodEnum.Donation]:
    'Given to a charity or another organisation; record the donee as the counterparty.',
  [DisposalMethodEnum.Loss]:
    'Lost and never recovered — one of the only two methods that can be executed for an asset whose custody is Missing.',
  [DisposalMethodEnum.Theft]:
    'Stolen — like Loss, executable for an asset nobody can produce; file the police report against the request as a document.',
  [DisposalMethodEnum.ReturnToSupplier]:
    'Sent back to the supplier under warranty or a buy-back; the credit note is the counterparty reference.',
  [DisposalMethodEnum.TradeIn]:
    'Traded against a replacement — the trade-in value and a currency are required at execution.',
  [DisposalMethodEnum.Destruction]:
    'Physically destroyed; attach the certificate of destruction afterwards.',
  [DisposalMethodEnum.Recycling]:
    'Handed to a licensed recycler; attach the recycling receipt afterwards.',
};

/**
 * Surfaced wherever Execute is pre-flighted away. Disposal never retires
 * implicitly — retirement carries its own guards, reason and history event, so
 * hiding it inside execution would make the history read as though the asset
 * was never retired (phase design §2).
 */
export const RETIRE_FIRST_NOTE =
  'Retire the asset first — disposal never retires implicitly. Retirement has its own guards and its own history event, and execution refuses anything that is not already Retired.';

/**
 * Surfaced when a Missing asset is paired with a method that cannot accept it.
 * Loss and Theft are the honest records for an asset nobody can produce; you
 * cannot sell, scrap, donate or trade in what you do not have.
 */
export const MISSING_CUSTODY_NOTE =
  'Only a Loss or Theft disposal can be executed for an asset nobody can produce. Change the method, or find the asset and record it before disposing of it.';

/** Shown under the requires-data-wipe checkbox — the certificate gates execution. */
export const REQUIRES_DATA_WIPE_NOTE =
  'Execution will demand at least one data-wipe certificate against this request before it will run. Certificates are recorded from the request’s details, and can still be filed after execution when one arrives late.';
