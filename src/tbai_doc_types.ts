/**
 * Copyright 2021 Binovo IT Human Project SL
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
 */
import { InvoiceId, PreviousInvoiceId } from "./invoice_id";
export { InvoiceId, PreviousInvoiceId };

export interface Issuer {
    irsId: string;
    name: string;
}

export interface Recipient {
    irsId: string;
    name: string;
    postal: string;
    address: string;
}

export interface TaxType {
    id: string;
    name: string;
    tax: number;
}

export interface InvoiceLine {
    description: string;
    quantity: number;
    price: number;
    discount: number;
    amount: number;
    amountWithVat: number;
    vat: number;
    discountAmount: number;
}

export interface VatLine {
    base: number;
    rate: number;
    amount: number;
}

export interface InvoiceDescription {
    text: string;
    operationDate: Date;
}

export type VatKey =
    | "01" // Operación de régimen general y cualquier otro supuesto que no esté recogido en los siguientes valores
    | "02" // Exportación
    | "03" // Operaciones a las que se aplique el régimen especial de bienes usados, objetos de arte, antigüedades y objetos de colección
    | "04" // Régimen especial del oro de inversión
    | "05" // Régimen especial de las agencias de viajes
    | "06" // Régimen especial grupo de entidades en IVA (Nivel Avanzado)
    | "07" // Régimen especial del criterio de caja
    | "08" // Operaciones sujetas al IPSI/IGIC (Impuesto sobre la Producción, los Servicios y la Importación / Impuesto General Indirecto Canario)
    | "09" // Facturación de las prestaciones de servicios de agencias de viaje que actúan como mediadoras en nombre y por cuenta ajena (disposición adicional 3ª del Reglamento de Facturación)
    | "10" // Cobros por cuenta de terceros o terceras de honorarios profesionales o de derechos derivados de la propiedad industrial, de autor u otros por cuenta de sus socios, socias, asociados, asociadas, colegiados o colegiadas efectuados por sociedades, asociaciones, colegios profesionales u otras entidades que realicen estas funciones de cobro
    | "11" // Operaciones de arrendamiento de local de negocio sujetos a retención
    | "12" // Operaciones de arrendamiento de local de negocio no sujetos a retención
    | "13" // Operaciones de arrendamiento de local de negocio sujetas y no sujetas a retención
    | "14" // Factura con IVA pendiente de devengo en certificaciones de obra cuyo destinatario sea una Administración Pública
    | "15" // Factura con IVA pendiente de devengo en operaciones de tracto sucesivo
    | "51" // Operaciones en recargo de equivalencia
    | "52" // Operaciones en régimen simplificado
    | "53"; // Operaciones realizadas por personas o entidades que no tengan la consideración de empresarios, empresarias o profesionales a efectos del IVA

export interface Invoice {
    issuer: Issuer;
    recipient?: Recipient;
    id: InvoiceId;
    simple: boolean;
    description: InvoiceDescription;
    vatLines: Array<VatLine>;
    lines: Array<InvoiceLine>;
    total: number;
    vatKeys: Array<VatKey>;
}

export interface ChainedInvoice {
    invoice: Invoice;
    previousId: PreviousInvoiceId | null;
}
