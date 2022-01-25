/**
 * Copyright 2021 Binovo IT Human Project SL
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
 */
export interface InvoiceId {
    serie?: string;
    number: string;
    issuedTime: Date;
}

export interface PreviousInvoiceId extends InvoiceId {
    hash: string;
}
