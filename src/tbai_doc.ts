/**
 * Copyright 2021 Binovo IT Human Project SL
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
 */
import "regenerator-runtime/runtime";
import {
    FormatAndValidationFunction,
    round2ToString,
    round8ToString,
    SimpleType,
    toDateString,
    toStringMaxLength,
    toStringRegexp,
    toStringTruncate,
    toTimeString,
} from "./to_string";
import {
    Invoice,
    InvoiceDescription,
    InvoiceLine,
    PreviousInvoiceId,
    Recipient,
    VatKey,
    VatLine,
} from "./tbai_doc_types";
export type {
    ChainedInvoice,
    Invoice,
    InvoiceDescription,
    InvoiceId,
    InvoiceLine,
    Issuer,
    PreviousInvoiceId,
    Recipient,
    TaxType,
    VatKey,
    VatLine,
} from "./tbai_doc_types";

const toStr20 = toStringMaxLength(20);
const toStr30 = toStringMaxLength(30);
const toStrTruncate100 = toStringTruncate(100);
const toStr120 = toStringMaxLength(120);
const toStr250 = toStringMaxLength(250);
const toNifStr = toStringRegexp(
    /^(([a-z|A-Z]{1}\d{7}[a-z|A-Z]{1})|(\d{8}[a-z|A-Z]{1})|([a-z|A-Z]{1}\d{8}))$/
);
const toEsPostal = toStringRegexp(/^\d{5}$/);
const INVOICE_LINES_MAX = 1000;

function updateDocument(
    doc: Document,
    selectorsToValues: Array<[string, SimpleType, FormatAndValidationFunction]>
): void {
    for (const [selector, value, convert] of selectorsToValues) {
        const node = doc.querySelector(selector);
        if (node) {
            if (undefined === value && node.parentNode) {
                node.parentNode.removeChild(node);
            } else {
                node.textContent = convert(value);
            }
        }
    }
}

export interface Software {
    license: string;
    developerIrsId: string; // IRS ID, only developers registered in Spain supported at this moment
    name: string;
    version: string;
}

export interface ToXmlOptions {
    deviceId?: string;
    roundTaxGlobally?: boolean;
}

const TBAI_XML_BASE = `
<tbai:TicketBai xmlns:tbai="urn:ticketbai:emision">
    <Cabecera>
        <IDVersionTBAI>1.2</IDVersionTBAI>
    </Cabecera>
    <Sujetos>
        <Emisor>
            <NIF>????</NIF>
            <ApellidosNombreRazonSocial>????</ApellidosNombreRazonSocial>
        </Emisor>
        <Destinatarios/>
    </Sujetos>
    <Factura>
        <CabeceraFactura>
            <SerieFactura>????</SerieFactura>
            <NumFactura>????</NumFactura>
            <FechaExpedicionFactura>????</FechaExpedicionFactura>
            <HoraExpedicionFactura>????</HoraExpedicionFactura>
            <FacturaSimplificada>S</FacturaSimplificada>
        </CabeceraFactura>
        <DatosFactura>
            <FechaOperacion>????</FechaOperacion>
            <DescripcionFactura>????</DescripcionFactura>
            <DetallesFactura></DetallesFactura>
            <ImporteTotalFactura>????</ImporteTotalFactura>
            <Claves></Claves>
        </DatosFactura>
        <TipoDesglose/>
    </Factura>
    <HuellaTBAI>
        <EncadenamientoFacturaAnterior>
            <SerieFacturaAnterior>????</SerieFacturaAnterior>
            <NumFacturaAnterior>????</NumFacturaAnterior>
            <FechaExpedicionFacturaAnterior>????</FechaExpedicionFacturaAnterior>
            <SignatureValueFirmaFacturaAnterior>????</SignatureValueFirmaFacturaAnterior>
        </EncadenamientoFacturaAnterior>
        <Software>
            <LicenciaTBAI>????</LicenciaTBAI>
            <EntidadDesarrolladora>
                <NIF>????</NIF>
            </EntidadDesarrolladora>
            <Nombre>????</Nombre>
            <Version>????</Version>
        </Software>
        <NumSerieDispositivo>????</NumSerieDispositivo>
    </HuellaTBAI>
</tbai:TicketBai>`
    .replace(/>\s+</g, "><")
    .replace(/\s*xmlns/g, " xmlns");

function removeElement(e: Node): boolean {
    if (e.parentNode) {
        e.parentNode.removeChild(e);
        return true;
    }
    return false;
}

function addLineNode(xml: Document, linesNode: Node, line: InvoiceLine): void {
    const lineNode = xml.createElement("IDDetalleFactura"),
        descriptionNode = xml.createElement("DescripcionDetalle"),
        quantityNode = xml.createElement("Cantidad"),
        priceNode = xml.createElement("ImporteUnitario"),
        discountNode = xml.createElement("Descuento"),
        amountNode = xml.createElement("ImporteTotal");
    descriptionNode.textContent = toStr250(line.description);
    quantityNode.textContent = round2ToString(line.quantity);
    priceNode.textContent = round8ToString(line.price);
    discountNode.textContent = round2ToString(line.discountAmount);
    amountNode.textContent = round2ToString(line.amountWithVat);
    linesNode.appendChild(lineNode);
    lineNode.appendChild(descriptionNode);
    lineNode.appendChild(quantityNode);
    lineNode.appendChild(priceNode);
    lineNode.appendChild(discountNode);
    lineNode.appendChild(amountNode);
}

function addRecipient(xml: Document, recipient?: Recipient): void {
    if (!recipient) {
        xml.querySelectorAll("Destinatarios").forEach(removeElement);
        return;
    }
    const tpl = `
        <IDDestinatario>
            <NIF/>
            <ApellidosNombreRazonSocial/>
            <CodigoPostal/>
            <Direccion/>
        </IDDestinatario>
    `.replace(/>\s+</g, "><");
    const newXml = new DOMParser().parseFromString(tpl, "application/xml");
    // prettier-ignore
    updateDocument(newXml, [
        ['NIF'                       , recipient.irsId  , toNifStr],
        ['ApellidosNombreRazonSocial', recipient.name   , toStr120],
        ['CodigoPostal'              , recipient.postal , toEsPostal],
        ['Direccion'                 , recipient.address, toStr250]
    ]);
    if (!recipient.postal) {
        /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
        newXml.querySelectorAll("CodigoPostal").forEach(removeElement);
    }
    if (!recipient.address) {
        /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
        newXml.querySelectorAll("Direccion").forEach(removeElement);
    }
    const parentNode = xml.querySelector("Destinatarios");
    if (!parentNode) {
        throw new Error("Missing Destinatarios element");
    }
    parentNode.appendChild(newXml.documentElement);
}

function addVatKeyNode(xml: Document, vatKeysNode: Node, vatKey: VatKey): void {
    const vatKeyNode = xml.createElement("IDClave"),
        opNode = xml.createElement("ClaveRegimenIvaOpTrascendencia");
    opNode.textContent = vatKey;
    vatKeysNode.appendChild(vatKeyNode);
    vatKeyNode.appendChild(opNode);
}

function addNotExemptedVatLineNode(xml: Document, vatLinesNode: Element, vatLine: VatLine): void {
    const vatNode = xml.createElement("DetalleIVA"),
        baseNode = xml.createElement("BaseImponible"),
        rateNode = xml.createElement("TipoImpositivo"),
        amountNode = xml.createElement("CuotaImpuesto");

    baseNode.textContent = round2ToString(vatLine.base);
    rateNode.textContent = round2ToString(vatLine.rate);
    amountNode.textContent = round2ToString(vatLine.amount);

    vatLinesNode.appendChild(vatNode);
    vatNode.appendChild(baseNode);
    vatNode.appendChild(rateNode);
    vatNode.appendChild(amountNode);
    if (vatLine.isUsingSimplifiedRegime) {
        const sNode = xml.createElement("OperacionEnRecargoDeEquivalenciaORegimenSimplificado");
        sNode.textContent = "S";
        vatNode.appendChild(sNode);
    }
}

function addVatBreakdown(xml: Document, vatBreakdownNode: Element, vatLines: Array<VatLine>): void {
    const notExemptedMaxCount = 6,
        subjectToVatNode = xml.createElement("Sujeta"),
        notExemptedNode = xml.createElement("NoExenta"),
        notExemptedS1DetailsNode = xml.createElement("DetalleNoExenta"),
        notExemptedS1TypeNode = xml.createElement("TipoNoExenta"),
        notExemptedS1BreakdownNode = xml.createElement("DesgloseIVA");

    if (notExemptedMaxCount < vatLines.length) {
        throw new Error("Not exempted VAT max. occurs is " + notExemptedMaxCount);
    }
    vatBreakdownNode.appendChild(subjectToVatNode);
    subjectToVatNode.appendChild(notExemptedNode);
    notExemptedNode.appendChild(notExemptedS1DetailsNode);
    notExemptedS1TypeNode.textContent = "S1";
    notExemptedS1DetailsNode.appendChild(notExemptedS1TypeNode);
    notExemptedS1DetailsNode.appendChild(notExemptedS1BreakdownNode);
    for (const vatLine of vatLines) {
        addNotExemptedVatLineNode(xml, notExemptedS1BreakdownNode, vatLine);
    }
}

function addSpanishVatBreakdown(
    xml: Document,
    vatBreakdownNode: Node,
    vatLines: Array<VatLine>
): void {
    const spanishVatBreakdownNode = xml.createElement("DesgloseFactura");
    vatBreakdownNode.appendChild(spanishVatBreakdownNode);
    addVatBreakdown(xml, spanishVatBreakdownNode, vatLines);
}

export function toXmlDocument(
    invoice: Invoice,
    previousId: PreviousInvoiceId | null,
    software: Software,
    options?: ToXmlOptions
): XMLDocument {
    options = options || {};

    const xml = new DOMParser().parseFromString(TBAI_XML_BASE, "application/xml");
    const description: InvoiceDescription = invoice.description;
    // prettier-ignore
    let selectorsToValues: Array<[string, SimpleType, FormatAndValidationFunction]> = [
        ["Emisor>NIF"                            , invoice.issuer.irsId      , toNifStr],
        ["Emisor>ApellidosNombreRazonSocial"     , invoice.issuer.name       , toStr120],
        ["CabeceraFactura>SerieFactura"          , invoice.id.serie          , toStr20],
        ["CabeceraFactura>NumFactura"            , invoice.id.number         , toStr20],
        ["CabeceraFactura>FechaExpedicionFactura", invoice.id.issuedTime     , toDateString],
        ["CabeceraFactura>HoraExpedicionFactura" , invoice.id.issuedTime     , toTimeString],
        ["FechaOperacion"                        , description.operationDate , toDateString],
        ["DescripcionFactura"                    , description.text          , toStr250],
        ["ImporteTotalFactura"                   , invoice.total             , round2ToString],
        ["Software>LicenciaTBAI"                 , software.license          , toStr20],
        ["Software>Nombre"                       , software.name             , toStr120],
        ["Software>Version"                      , software.version          , toStr20],
        ["EntidadDesarrolladora>NIF"             , software.developerIrsId   , toNifStr]
    ];
    // prettier-ignore
    if (previousId) {
        selectorsToValues = selectorsToValues.concat([
        ["SerieFacturaAnterior"                  , previousId.serie        , toStr20],
        ["NumFacturaAnterior"                    , previousId.number       , toStr20],
        ["FechaExpedicionFacturaAnterior"        , previousId.issuedTime   , toDateString],
        ["SignatureValueFirmaFacturaAnterior"    , previousId.hash         , toStrTruncate100],
        ]);
    } else {
        xml.querySelectorAll("EncadenamientoFacturaAnterior").forEach(removeElement);
    }
    // recipient
    addRecipient(xml, invoice.recipient);
    // prettier-ignore
    if (options.deviceId) {
        selectorsToValues = selectorsToValues.concat([
        ["NumSerieDispositivo"                   , options.deviceId        , toStr30],
        ]);
    } else {
        xml.querySelectorAll("NumSerieDispositivo").forEach(removeElement);
    }
    updateDocument(xml, selectorsToValues);
    // vat lines
    const vatBreakdownNode = xml.querySelector("TipoDesglose");
    if (vatBreakdownNode) {
        addSpanishVatBreakdown(xml, vatBreakdownNode, invoice.vatLines);
    } else {
        throw new Error("TipoDesglose XML node is required.");
    }
    // detail lines
    if (invoice.lines.length > INVOICE_LINES_MAX) {
        throw new Error("Only up to 1000 invoice lines allowed");
    }
    if (invoice.lines.length > 0) {
        const linesNode = xml.querySelector("DetallesFactura");
        if (!linesNode) {
            throw new Error("Missing DetallesFactura element");
        }
        for (const line of invoice.lines) {
            addLineNode(xml, linesNode, line);
        }
    } else {
        xml.querySelectorAll("DetallesFactura").forEach(removeElement);
    }
    // vat keys
    const vatKeys: Array<VatKey> = invoice.vatKeys;
    const vatKeysNode = xml.querySelector("Claves");
    if (!vatKeysNode) {
        throw new Error("Missing Claves element");
    }
    for (const vatKey of vatKeys) {
        addVatKeyNode(xml, vatKeysNode, vatKey);
    }
    return xml;
}

export function toXml(
    invoice: Invoice,
    previousId: PreviousInvoiceId | null,
    software: Software,
    options?: ToXmlOptions
): string {
    const xml = toXmlDocument(invoice, previousId, software, options);
    return new XMLSerializer().serializeToString(xml);
}
