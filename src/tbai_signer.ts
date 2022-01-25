/**
 * Copyright 2021 Binovo IT Human Project SL
 * License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
 */
import "regenerator-runtime/runtime";
import * as xades from "xadesjs";
import * as forge from "node-forge";
import { crc8 } from "crc";
import { PreviousInvoiceId } from "./invoice_id";
const TBAI_POLICY_1_2_URI =
    "https://www.batuz.eus/fitxategiak/batuz/ticketbai/sinadura_elektronikoaren_zehaztapenak_especificaciones_de_la_firma_electronica_v1_0.pdf";
const TBAI_POLICY_1_2_DIGEST = "Quzn98x3PMbSHwbUzaj5f5KOpiH0u8bvmwbbbNkO9Es=";

interface KeyCert {
    privateKey: CryptoKey;
    publicKey: CryptoKey;
    cert: string;
}

async function readAsArrayBuffer(f: File): Promise<ArrayBuffer> {
    return new Promise((ok, err) => {
        const reader = new FileReader();
        reader.onload = (): void => {
            ok(reader.result as ArrayBuffer);
        };
        reader.onerror = (): void => {
            console.log(["File read error", f, reader.error]);
            err(reader.error);
        };
        reader.onabort = (): void => {
            console.log(["File read abort", f, reader.error]);
            err(reader.error);
        };
        reader.readAsArrayBuffer(f);
    });
}

function defaultCrypto(): Crypto {
    // from "window" in browsers, from "global" in node.
    if (typeof window !== "undefined" && window.crypto) {
        return window.crypto;
    }
    return global.crypto;
}

async function loadCertFromP12Buffer(
    p12Der: ArrayBuffer,
    alias: string | null | undefined,
    password: string,
    crypto = defaultCrypto(),
    hash = "SHA-256"
): Promise<KeyCert> {
    const decode = forge.util.binary.raw.decode;
    const privateKeyToAsn1 = forge.pki.privateKeyToAsn1;
    const publicKeyToAsn1 = forge.pki.publicKeyToAsn1;
    const toDer = forge.asn1.toDer;
    const wrapRsaPrivateKey = forge.pki.wrapRsaPrivateKey;
    const p12Asn1 = forge.asn1.fromDer(new forge.util.ByteStringBuffer(p12Der));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    let forgeKey: forge.pki.PrivateKey | undefined = undefined;
    let cert: forge.pki.Certificate | undefined = undefined;
    if (alias && alias != " ") {
        const bags = p12.getBags({ friendlyName: alias });
        if (undefined == bags.friendlyName || bags.friendlyName.length != 2) {
            console.log("Unsupported keystore format, wrong password or wrong alias");
            throw new Error("Unsupported keystore format, wrong password or wrong alias");
        }
        if (bags.friendlyName[0].key && bags.friendlyName[1].cert) {
            forgeKey = bags.friendlyName[0].key;
            cert = bags.friendlyName[1].cert;
        } else if (bags.friendlyName[1].key && bags.friendlyName[0].cert) {
            forgeKey = bags.friendlyName[1].key;
            cert = bags.friendlyName[0].cert;
        } else {
            console.log("Unsupported keystore format, wrong password or wrong alias");
            throw new Error("Unsupported keystore format, wrong password or wrong alias");
        }
    } else {
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const pkcs8KeyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        if (certBags) {
            const certBag = certBags[forge.pki.oids.certBag];
            if (certBag && certBag[0]) {
                const certBagItem = certBag[0];
                if (certBagItem && certBagItem.cert) {
                    cert = certBagItem.cert;
                }
            } else {
                console.log("No forge.pki.oids.certBag found.");
                throw new Error("No forge.pki.oids.certBag found.");
            }
            const keyBag = pkcs8KeyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
            if (keyBag && keyBag[0]) {
                const keyBagItem = keyBag[0];
                if (keyBagItem && keyBagItem.key) {
                    forgeKey = keyBagItem.key;
                }
            } else {
                console.log("No forge.pki.oids.pkcs8ShroudedKeyBag found.");
                throw new Error("No forge.pki.oids.pkcs8ShroudedKeyBag found.");
            }
        } else {
            console.log("No certified bags found in p12 buffer.");
            throw new Error("No certified bags found in p12 buffer.");
        }
    }
    if (!cert || !forgeKey) {
        console.log("No certified/private key found in p12 buffer.");
        throw new Error("No certified/private key found in p12 buffer.");
    }
    const x509 = forge.pki.certificateToPem(cert);
    const publicKeyDer = decode(toDer(publicKeyToAsn1(cert.publicKey)).getBytes());
    const publicKey = await crypto.subtle.importKey(
        "spki",
        publicKeyDer,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: { name: hash },
        },
        true,
        ["verify"]
    );
    const pkcs8 = decode(toDer(wrapRsaPrivateKey(privateKeyToAsn1(forgeKey))).getBytes());
    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        pkcs8,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: { name: hash },
        },
        false,
        ["sign"]
    );
    return {
        privateKey: privateKey,
        publicKey: publicKey,
        cert: x509,
    };
}

// taken from https://stackoverflow.com/questions/11563554/how-do-i-detect-xml-parsing-errors-when-using-javascripts-domparser-in-a-cross
function isParseError(parsedDocument: Document): boolean {
    return parsedDocument.getElementsByTagName("parsererror").length > 0;
}

function parseXml(xml: string): Document {
    const doc = xades.Parse(xml);
    if (isParseError(doc)) {
        throw new Error("XML parse error");
    }
    return doc;
}

function getText(xml: Document, selector: string): string {
    const node = xml.querySelector(selector);
    if (node && node.textContent) {
        return node.textContent.replace(/\s/g, "");
    } else {
        throw new Error("Bad TBAI document. Element not found: " + selector);
    }
}

function getTextOrValue(xml: Document, selector: string, value: string): string {
    const node = xml.querySelector(selector);
    if (node && node.textContent) {
        return node.textContent.replace(/\s/g, "");
    } else {
        return value;
    }
}

function generateRandomId(crypto: Crypto): string {
    return (
        "id-" +
        Array.prototype.map
            .call(crypto.getRandomValues(new Uint8Array(6)), (x: number) =>
                ("00" + x.toString(16)).slice(-2)
            )
            .join("")
    );
}

function crc8ZeroFill(txt: string): string {
    return ("000" + crc8(txt)).slice(-3);
}

export function getTbaiId(xmlOrString: string | Document): string {
    let xml: Document;
    if (typeof xmlOrString === "string") {
        xml = parseXml(xmlOrString);
    } else {
        xml = xmlOrString;
    }
    const tbai = "TBAI";
    const issuerId = getText(xml, "Emisor>NIF");
    const issueDate = getText(xml, "FechaExpedicionFactura").replace(/(..)-(..)-..(..)/g, "$1$2$3");
    const signaturePrefix = getText(xml, "SignatureValue").substr(0, 13);
    const tbaiId = [tbai, issuerId, issueDate, signaturePrefix, ""].join("-");
    return tbaiId + crc8ZeroFill(tbaiId);
}

export function getTbaiChainInfo(xmlOrString: string | Document): PreviousInvoiceId {
    let xml: Document;
    if (typeof xmlOrString === "string") {
        xml = parseXml(xmlOrString);
    } else {
        xml = xmlOrString;
    }
    function getIssuedDate(): Date {
        const d = getText(xml, "FechaExpedicionFactura");
        const t = getText(xml, "HoraExpedicionFactura");
        return new Date(d.split("-").reverse().join("-") + " " + t);
    }
    const id: PreviousInvoiceId = {
        issuedTime: getIssuedDate(),
        number: getText(xml, "CabeceraFactura>NumFactura"),
        hash: getText(xml, "SignatureValue").substr(0, 100),
    };
    const serie = getTextOrValue(xml, "CabeceraFactura>SerieFactura", "");
    if (serie) {
        id.serie = serie;
    }
    return id;
}

export enum Irs {
    ARABA = 0,
    BIZKAIA = 1,
    GIPUZKOA = 2,
}

export function getTbaiUrlFromBaseURL(xmlOrString: string | Document, prefix: string): string {
    function serialize(obj: Record<string, string>): string {
        const str =
            "?" +
            Object.keys(obj)
                .reduce(function (a: Array<string>, k: string) {
                    a.push(k + "=" + encodeURIComponent(obj[k]));
                    return a;
                }, [])
                .join("&");
        return str;
    }
    let xml: Document;
    if (typeof xmlOrString === "string") {
        xml = parseXml(xmlOrString);
    } else {
        xml = xmlOrString;
    }
    const params = {
        id: getTbaiId(xml),
        s: getTextOrValue(xml, "SerieFactura", ""),
        nf: getText(xml, "NumFactura"),
        i: getText(xml, "ImporteTotalFactura"),
    };
    const url = prefix + serialize(params);
    return url + "&cr=" + crc8ZeroFill(url);
}

export function getTbaiUrl(xmlOrString: string | Document, irs: Irs, isTesting = false): string {
    const prefix = [
        [
            "https://ticketbai.araba.eus/TBAI/QRTBAI",
            "https://batuz.eus/QRTBAI/",
            "https://tbai.egoitza.gipuzkoa.eus/qr/",
        ],
        [
            "https://pruebas-ticketbai.araba.eus/tbai/qrtbai/",
            "https://batuz.eus/QRTBAI/",
            "https://tbai.prep.gipuzkoa.eus/qr/",
        ],
    ][isTesting ? 1 : 0][irs];
    return getTbaiUrlFromBaseURL(xmlOrString, prefix);
}

export class TbaiSigner {
    readonly privateKey: CryptoKey;
    readonly publicKey: CryptoKey;
    readonly cert: string; // base64 encoded certificate
    readonly crypto: Crypto;
    readonly hash: string;

    private constructor(
        privateKey: CryptoKey,
        publicKey: CryptoKey,
        cert: string,
        crypto: Crypto,
        hash: string
    ) {
        this.privateKey = privateKey;
        this.publicKey = publicKey;
        this.cert = cert;
        this.crypto = crypto;
        this.hash = hash;
    }

    static async fromBuffer(
        p12: ArrayBuffer,
        alias: string | null | undefined,
        password: string,
        crypto = defaultCrypto(),
        hash = "SHA-256"
    ): Promise<TbaiSigner> {
        const keyAndCert = await loadCertFromP12Buffer(p12, alias, password, crypto, hash);
        return new TbaiSigner(
            keyAndCert.privateKey,
            keyAndCert.publicKey,
            keyAndCert.cert,
            crypto,
            hash
        );
    }

    static async fromFile(
        p12File: File,
        alias: string | null | undefined,
        password: string,
        crypto = defaultCrypto(),
        hash = "SHA-256"
    ): Promise<TbaiSigner> {
        const p12 = await readAsArrayBuffer(p12File);
        return TbaiSigner.fromBuffer(p12, alias, password, crypto, hash);
    }

    async sign(
        xml: string,
        policyUri = TBAI_POLICY_1_2_URI,
        policyDigest = TBAI_POLICY_1_2_DIGEST
    ): Promise<string> {
        const signature = new xades.SignedXml();
        const keyInfoId = generateRandomId(this.crypto);
        const cert = this.cert.replace(/-----(BEGIN|END)[\w\d\s]+-----|[\r\n]/g, "");
        signature.XmlSignature.KeyInfo.Id = keyInfoId;
        await signature.Sign(
            // Signing document
            { name: "RSASSA-PKCS1-v1_5" }, // algorithm
            this.privateKey, // key
            parseXml(xml), // document
            {
                // options
                keyValue: this.publicKey,
                references: [
                    { hash: this.hash, uri: "", transforms: ["enveloped"] },
                    { hash: this.hash, uri: "#" + keyInfoId },
                ],
                policy: {
                    identifier: {
                        value: policyUri,
                    },
                    hash: {
                        name: this.hash,
                    },
                    digestValue: policyDigest,
                },
                signingCertificate: cert,
                x509: [cert],
            }
        );
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + signature.toString();
    }
}
