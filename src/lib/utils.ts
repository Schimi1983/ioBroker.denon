/**
 * Decode state e.g. for selectInput by searching for state in key and value of the states
 *
 * @alias decodeState
 * @param stateRecord key value pair of states
 * @param state state key or value which will be matched
 */
export function decodeState(stateRecord: Record<string, string>, state: string | number): string {
    for (const [id, name] of Object.entries(stateRecord)) {
        if (state.toString().toUpperCase() === name.toUpperCase() || id === state.toString()) {
            return name;
        }
    }
    return '';
}

/**
 * Convert volume to dB
 *
 * @alias volToDb
 * @param volStr level parameter, e.g. '505'
 * @returns dB
 */
export function volToDb(volStr: string): number {
    let vol: number;
    if (volStr.length === 3) {
        vol = parseInt(volStr) / 10; // "305" -> 30.5
    } else {
        vol = parseInt(volStr);
    }

    vol -= 50; // Vol to dB
    return vol;
}

/**
 * Tests whether the given variable is a real object and not an Array
 *
 * @param it The variable to test
 */
export function isObject(it: any): it is Record<string, any> {
    // This is necessary because:
    // typeof null === 'object'
    // typeof [] === 'object'
    // [] instanceof Object === true
    return Object.prototype.toString.call(it) === '[object Object]'; // this code is 25% faster then below one
}

/**
 * Resolves the key of a states map for a given value. Accepts the key itself or (case insensitive) its label.
 * For maps which use protocol codes as keys (e.g. { MOVI: 'Movie' }) this returns the protocol code.
 *
 * @param stateRecord common.states of the object
 * @param val value written by the user, either key or label
 * @returns the matching key or undefined
 */
export function resolveStateKey(
    stateRecord: Record<string, string> | undefined | null,
    val: ioBroker.StateValue,
): string | undefined {
    if (val === null || val === undefined) {
        return undefined;
    }
    const str = String(val).trim();
    if (!stateRecord || !isObject(stateRecord)) {
        return str || undefined;
    }
    if (Object.prototype.hasOwnProperty.call(stateRecord, str)) {
        return str;
    }
    const upper = str.toUpperCase();
    for (const [key, label] of Object.entries(stateRecord)) {
        if (String(label).toUpperCase() === upper) {
            return key;
        }
    }
    return undefined;
}
