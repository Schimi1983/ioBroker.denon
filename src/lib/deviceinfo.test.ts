import { expect } from 'chai';
import { buildBaseUrl, fetchDeviceInfo, parseDeviceInfo } from './deviceinfo';
import { ENUM_SETTINGS, findEnumSetting } from './settings';

/** Shortened Deviceinfo.xml of the AVR-X2200W (recorded live 2026-10-27) */
const X2200W = `<?xml version="1.0" encoding="utf-8" ?>
<Device_Info>
<DeviceInfoVers>0001</DeviceInfoVers>
<CommApiVers>0300</CommApiVers>
<Gen>0001</Gen>
<BrandCode>0</BrandCode>
<ProductCategory>01</ProductCategory>
<CategoryName>AV RECEIVER</CategoryName>
<ManualModelName>*AVR-X2200W</ManualModelName>
<ModelName>*AVR-X2200W</ModelName>
<DeviceZones>2</DeviceZones>
<DeviceCapabilities><Menu><lists>
<ItemType>1</ItemType><FuncName>DialogLevel</FuncName>
<ItemType>1</ItemType><FuncName>SpeakerAB</FuncName>
<ItemType>1</ItemType><FuncName>DialogLevel</FuncName>
<ItemType>1</ItemType><FuncName>AllZoneStereo</FuncName>
</lists></Menu></DeviceCapabilities>
</Device_Info>`;

function fakeFetch(map: Record<string, { status: number; body?: string } | 'throw'>): typeof fetch {
    return (url: string | URL | Request): Promise<Response> => {
        const key = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
        const entry = map[key];
        if (!entry || entry === 'throw') {
            return Promise.reject(new Error('ECONNREFUSED'));
        }
        return Promise.resolve(new Response(entry.body ?? '', { status: entry.status }));
    };
}

describe('deviceinfo', () => {
    it('parses brand, model, zones and functions', () => {
        const info = parseDeviceInfo(X2200W, 80);
        expect(info).to.deep.equal({
            model: 'AVR-X2200W',
            brand: 'Denon',
            zones: 2,
            commApiVersion: '0300',
            functions: ['DialogLevel', 'SpeakerAB', 'AllZoneStereo'],
            port: 80,
        });
    });

    it('detects Marantz by brand code', () => {
        const xml = X2200W.replace('<BrandCode>0</BrandCode>', '<BrandCode>1</BrandCode>').replace(
            /AVR-X2200W/g,
            'SR6015',
        );
        expect(parseDeviceInfo(xml, 8080)).to.deep.include({ brand: 'Marantz', model: 'SR6015', port: 8080 });
    });

    it('rejects unrelated documents', () => {
        expect(parseDeviceInfo('<html>403 Forbidden</html>', 80)).to.equal(undefined);
    });

    it('puts IPv6 literals in brackets', () => {
        expect(buildBaseUrl('192.168.20.17', 80)).to.equal('http://192.168.20.17:80');
        expect(buildBaseUrl('fd00::17', 8080)).to.equal('http://[fd00::17]:8080');
        expect(buildBaseUrl('[fd00::17]', 80)).to.equal('http://[fd00::17]:80');
        expect(buildBaseUrl('avr.local', 80)).to.equal('http://avr.local:80');
    });

    it('falls back to port 8080 for 2016+ models (port 80 answers 403)', async () => {
        const info = await fetchDeviceInfo(
            'avr',
            500,
            fakeFetch({
                'http://avr:80/goform/Deviceinfo.xml': { status: 403 },
                'http://avr:8080/goform/Deviceinfo.xml': { status: 200, body: X2200W },
            }),
        );
        expect(info?.port).to.equal(8080);
    });

    it('returns undefined if HTTP is not reachable', async () => {
        expect(await fetchDeviceInfo('avr', 500, fakeFetch({}))).to.equal(undefined);
    });
});

describe('settings', () => {
    it('maps responses recorded on the AVR-X2200W', () => {
        expect(findEnumSetting('STBY30M')).to.deep.include({ value: '30M' });
        expect(findEnumSetting('STBY30M')?.setting.id).to.equal('settings.autoStandby');
        expect(findEnumSetting('ECOAUTO')?.setting.id).to.equal('settings.ecoMode');
        expect(findEnumSetting('PSDRC AUTO')).to.deep.include({ value: 'AUTO' });
        expect(findEnumSetting('PSRSTR OFF')?.setting.id).to.equal('settings.audioRestorer');
        expect(findEnumSetting('SDNO')?.setting.id).to.equal('settings.inputMode');
        expect(findEnumSetting('DCAUTO')?.setting.id).to.equal('settings.digitalInputMode');
    });

    it('ignores unrelated lines and empty values', () => {
        expect(findEnumSetting('MV455')).to.equal(undefined);
        expect(findEnumSetting('SSINFAISFSV 48K')).to.equal(undefined);
        expect(findEnumSetting('ECO')).to.equal(undefined);
    });

    it('has unique prefixes', () => {
        const prefixes = ENUM_SETTINGS.map(s => s.prefix);
        expect(new Set(prefixes).size).to.equal(prefixes.length);
    });
});
