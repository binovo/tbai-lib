import "regenerator-runtime/runtime";
import { P12_FILE, P12_PASSWORD, P12_ALIAS, loadBinaryFile } from "./common";
import * as tbai from "../src/tbai";
import { toDateString } from "../src/to_string";

function texts(xml: Document, query: string): Array<string | null> {
    return Array.from(xml.querySelectorAll(query)).map((e) => e.textContent);
}

function checkXml(xml: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = new XMLHttpRequest();
        const url = "tbaiCheckInvoiceXml";
        req.responseType = "text";
        req.timeout = 1000;
        req.onreadystatechange = (): void => {
            if (req.readyState == 4) {
                if (req.status == 200) {
                    resolve(req.response);
                } else {
                    reject();
                }
            }
        };
        req.open("POST", url, true);
        req.send(xml);
    });
}

describe("This are the input validations: ", () => {
    it("only up 1000 lines allowed", () => {
        const invoiceLines: Array<tbai.InvoiceLine> = [];
        for (let i = 0; i < 1001; i++) {
            invoiceLines.push({
                description: "Line 0" + i,
                quantity: 1,
                price: 2,
                amount: 2,
                amountWithVat: 2.42,
                vat: 21,
                discount: 0,
                discountAmount: 0,
            });
        }
        const invoice: tbai.Invoice = {
            issuer: {
                irsId: "X0000000X",
                name: "Binovo IT",
            },
            id: {
                number: "1",
                issuedTime: new Date(),
            },
            description: {
                text: "Invoice description",
                operationDate: new Date(),
            },
            lines: invoiceLines,
            vatKeys: ["01"],
            vatLines: [
                {
                    base: 2002,
                    rate: 21,
                    amount: 420.42,
                },
            ],
            simple: true,
            total: 2422.42,
        };
        const previousId: tbai.PreviousInvoiceId = {
            number: "0",
            issuedTime: new Date(),
            hash: "xxx",
        };
        const software: tbai.Software = {
            license: "LICENSE CODE",
            developerIrsId: "X0000000X",
            name: "Acme TBAI",
            version: "0.1",
        };
        expect(() => {
            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            const xml = tbai.toXmlDocument(invoice, previousId, software);
        }).toThrow(new Error("Only up to 1000 invoice lines allowed"));
    });
});

describe("We can create an invoice ", () => {
    let signer: tbai.TbaiSigner;

    beforeEach(async () => {
        const p12 = await loadBinaryFile(P12_FILE);
        signer = await tbai.TbaiSigner.fromBuffer(p12, P12_ALIAS, P12_PASSWORD);
    });

    it("invoice without lines", async () => {
        const invoice: tbai.Invoice = {
            issuer: {
                irsId: "99999990S",
                name: "Acme Inc.",
            },
            simple: true,
            id: {
                number: "100",
                issuedTime: new Date(),
            },
            description: {
                text: "Invoice description",
                operationDate: new Date(),
            },
            lines: [],
            vatKeys: ["01"],
            vatLines: [
                {
                    base: 250,
                    rate: 21,
                    amount: 52.5,
                },
            ],
            total: 302.5,
        };
        const previousId: tbai.PreviousInvoiceId = {
            number: "0",
            issuedTime: new Date(),
            hash: "xxx",
        };
        const software: tbai.Software = {
            license: "LICENSE CODE",
            developerIrsId: "X0000000X",
            name: "Acme TBAI",
            version: "0.1",
        };
        const xml = tbai.toXmlDocument(invoice, previousId, software);
        const xmlString = new XMLSerializer().serializeToString(xml);
        const signedXml = await signer.sign(xmlString);
        expect(await checkXml(signedXml)).toBe("ok");
        expect(xml).toBeTruthy();
        expect(texts(xml, "DetalleIVA>BaseImponible")).toEqual(["250.00"]);
        expect(texts(xml, "DetalleIVA>TipoImpositivo")).toEqual(["21.00"]);
        expect(texts(xml, "DetalleIVA>CuotaImpuesto")).toEqual(["52.50"]);
        expect(texts(xml, "ImporteTotalFactura")).toEqual(["302.50"]);
    });

    it("invoice with lines", async () => {
        const invoice: tbai.Invoice = {
            issuer: {
                irsId: "99999990S",
                name: "Acme Inc.",
            },
            simple: true,
            id: {
                number: "100",
                issuedTime: new Date(),
            },
            description: {
                text: "Invoice description",
                operationDate: new Date(),
            },
            lines: [
                {
                    description: "Line 01",
                    quantity: 1,
                    price: 250,
                    amount: 250,
                    amountWithVat: 302.5,
                    vat: 21,
                    discount: 0,
                    discountAmount: 0,
                },
            ],
            vatKeys: ["01"],
            vatLines: [
                {
                    base: 250,
                    rate: 21,
                    amount: 52.5,
                },
            ],
            total: 302.5,
        };
        const previousId: tbai.PreviousInvoiceId = {
            number: "0",
            issuedTime: new Date(),
            hash: "xxx",
        };
        const software: tbai.Software = {
            license: "LICENSE CODE",
            developerIrsId: "X0000000X",
            name: "Acme TBAI",
            version: "0.1",
        };
        const xml = tbai.toXmlDocument(invoice, previousId, software);
        const xmlString = new XMLSerializer().serializeToString(xml);
        const signedXml = await signer.sign(xmlString);
        expect(await checkXml(signedXml)).toBe("ok");
        expect(xml).toBeTruthy();
        expect(texts(xml, "DetalleIVA>BaseImponible")).toEqual(["250.00"]);
        expect(texts(xml, "DetalleIVA>TipoImpositivo")).toEqual(["21.00"]);
        expect(texts(xml, "DetalleIVA>CuotaImpuesto")).toEqual(["52.50"]);
        expect(texts(xml, "ImporteTotalFactura")).toEqual(["302.50"]);
    });

    it("invoice with lines and recipient", async () => {
        const invoiceDate = new Date();
        const invoice: tbai.Invoice = {
            issuer: {
                irsId: "99999990S",
                name: "Acme Inc.",
            },
            recipient: {
                irsId: "B0000000B",
                name: "Acme Inc.",
                postal: "08080",
                address: "Acme address 12",
            },
            simple: true,
            id: {
                number: "100",
                issuedTime: invoiceDate,
            },
            description: {
                text: "Invoice description",
                operationDate: invoiceDate,
            },
            lines: [
                {
                    description: "Line 01",
                    quantity: 1,
                    price: 250,
                    amount: 250,
                    amountWithVat: 302.5,
                    vat: 21,
                    discount: 0,
                    discountAmount: 0,
                },
            ],
            vatKeys: ["01"],
            vatLines: [
                {
                    base: 250,
                    rate: 21,
                    amount: 52.5,
                },
            ],
            total: 302.5,
        };
        const previousId: tbai.PreviousInvoiceId = {
            number: "0",
            issuedTime: new Date(),
            hash: "xxx",
        };
        const software: tbai.Software = {
            license: "LICENSE CODE",
            developerIrsId: "X0000000X",
            name: "Acme TBAI",
            version: "0.1",
        };
        const xml = tbai.toXmlDocument(invoice, previousId, software);
        const xmlString = new XMLSerializer().serializeToString(xml);
        const signedXml = await signer.sign(xmlString);
        expect(await checkXml(signedXml)).toBe("ok");
        expect(xml).toBeTruthy();
        expect(texts(xml, "Emisor>NIF")).toEqual([invoice.issuer.irsId]);
        expect(texts(xml, "Emisor>ApellidosNombreRazonSocial")).toEqual([invoice.issuer.name]);
        expect(texts(xml, "FechaExpedicionFactura")).toEqual([toDateString(invoiceDate)]);
        expect(texts(xml, "IDDestinatario>NIF")).toEqual(["B0000000B"]);
        expect(texts(xml, "IDDestinatario>ApellidosNombreRazonSocial")).toEqual(["Acme Inc."]);
        expect(texts(xml, "DetalleIVA>BaseImponible")).toEqual(["250.00"]);
        expect(texts(xml, "DetalleIVA>TipoImpositivo")).toEqual(["21.00"]);
        expect(texts(xml, "DetalleIVA>CuotaImpuesto")).toEqual(["52.50"]);
        expect(texts(xml, "ImporteTotalFactura")).toEqual(["302.50"]);
        expect(texts(xml, "LicenciaTBAI")).toEqual([software.license]);
        expect(texts(xml, "EntidadDesarrolladora>NIF")).toEqual([software.developerIrsId]);
        expect(texts(xml, "Software>Nombre")).toEqual([software.name]);
        expect(texts(xml, "Software>Version")).toEqual([software.version]);
        expect(texts(xml, "ClaveRegimenIvaOpTrascendencia")).toEqual(["01"]);
    });
});
