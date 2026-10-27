/**
 * Reads /goform/Deviceinfo.xml of Denon/Marantz AVRs.
 *
 * @KI_HINWEIS: HTTP is only used once at startup to identify the device (brand, model, number of zones).
 * All control and state updates still use telnet. Models up to 2015 serve the file on port 80, models from
 * 2016 on port 8080 (port 80 answers 403 there). AppCommand.xml is not used because e.g. the AVR-X2200W
 * returns an empty <rx/> for it.
 */

/** Brand of the AVR */
export type AvrBrand = 'Denon' | 'Marantz' | 'unknown';

/** Parsed device information */
export interface DeviceInfo {
    /** Model name without the leading "*", e.g. "AVR-X2200W" */
    model: string;
    /** Brand derived from BrandCode (0 = Denon, 1 = Marantz) */
    brand: AvrBrand;
    /** Number of zones incl. main zone, undefined if not reported */
    zones?: number;
    /** Version of the communication API, e.g. "0300" */
    commApiVersion?: string;
    /** Function names of the capability menu (unique), e.g. "SpeakerAB", "AllZoneStereo" */
    functions: string[];
    /** Port the file was served on */
    port: number;
}

/**
 * Builds a HTTP base URL, IPv6 literals are put in brackets
 *
 * @param host IPv4, IPv6 or hostname
 * @param port TCP port
 */
export function buildBaseUrl(host: string, port: number): string {
    const h = host.trim();
    const needsBrackets = h.includes(':') && !h.startsWith('[');
    return `http://${needsBrackets ? `[${h}]` : h}:${port}`;
}

/**
 * Returns the text of the first element with the given tag name
 *
 * @param xml xml document
 * @param tag tag name
 */
function tagText(xml: string, tag: string): string | undefined {
    const match = new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`).exec(xml);
    return match ? match[1] : undefined;
}

/**
 * Parses the content of Deviceinfo.xml
 *
 * @param xml file content
 * @param port port it was loaded from
 * @returns device info or undefined if it does not look like a Denon/Marantz device info
 */
export function parseDeviceInfo(xml: string, port: number): DeviceInfo | undefined {
    if (!xml.includes('<Device_Info>')) {
        return undefined;
    }
    const model = (tagText(xml, 'ModelName') ?? tagText(xml, 'ManualModelName') ?? '').replace(/^\*/, '').trim();
    const brandCode = tagText(xml, 'BrandCode');
    const brand: AvrBrand = brandCode === '0' ? 'Denon' : brandCode === '1' ? 'Marantz' : 'unknown';
    const zonesRaw = tagText(xml, 'DeviceZones');
    const zones = zonesRaw && /^\d+$/.test(zonesRaw) ? parseInt(zonesRaw, 10) : undefined;
    const functions = [...new Set([...xml.matchAll(/<FuncName>\s*([^<]+?)\s*<\/FuncName>/g)].map(m => m[1]))];
    return {
        model,
        brand,
        zones,
        commApiVersion: tagText(xml, 'CommApiVers'),
        functions,
        port,
    };
}

/**
 * Loads the device info, trying port 80 first and 8080 afterwards
 *
 * @param host IPv4, IPv6 or hostname
 * @param timeoutMs timeout per request
 * @param fetchFn fetch implementation (injectable for tests)
 */
export async function fetchDeviceInfo(
    host: string,
    timeoutMs = 3_000,
    fetchFn: typeof fetch = fetch,
): Promise<DeviceInfo | undefined> {
    for (const port of [80, 8080]) {
        try {
            const res = await fetchFn(`${buildBaseUrl(host, port)}/goform/Deviceinfo.xml`, {
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!res.ok) {
                continue;
            }
            const info = parseDeviceInfo(await res.text(), port);
            if (info) {
                return info;
            }
        } catch {
            // try next port
        }
    }
    return undefined;
}
