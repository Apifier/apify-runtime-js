import { ENV_VARS } from 'apify-shared/consts';
import playwright from 'playwright';
import log from '../../build/utils_log';
import * as Apify from '../../build';
import LocalStorageDirEmulator from '../local_storage_dir_emulator';
import * as utils from '../../build/utils';

describe('PlaywrightCrawler', () => {
    let prevEnvHeadless;
    let logLevel;
    let localStorageEmulator;
    let requestList;

    beforeAll(async () => {
        prevEnvHeadless = process.env[ENV_VARS.HEADLESS];
        process.env[ENV_VARS.HEADLESS] = '1';
        logLevel = log.getLevel();
        log.setLevel(log.LEVELS.ERROR);
        localStorageEmulator = new LocalStorageDirEmulator();
    });
    beforeEach(async () => {
        const storageDir = await localStorageEmulator.init();
        utils.apifyStorageLocal = utils.newStorageLocal({ storageDir });
        const sources = ['http://example.com/'];
        requestList = await Apify.openRequestList(`sources-${Math.random * 10000}`, sources);
    });
    afterAll(async () => {
        log.setLevel(logLevel);
        process.env[ENV_VARS.HEADLESS] = prevEnvHeadless;
        await localStorageEmulator.destroy();
    });

    describe('should work', () => {
        ['webkit', 'chromium', 'firefox'].forEach((browser) => {
            test(`with ${browser}`, async () => {
                const sourcesLarge = [
                    { url: 'http://example.com/?q=1' },
                    { url: 'http://example.com/?q=2' },
                    { url: 'http://example.com/?q=3' },
                    { url: 'http://example.com/?q=4' },
                    { url: 'http://example.com/?q=5' },
                    { url: 'http://example.com/?q=6' },
                ];
                const sourcesCopy = JSON.parse(JSON.stringify(sourcesLarge));
                const processed = [];
                const failed = [];
                const requestListLarge = new Apify.RequestList({ sources: sourcesLarge });
                const handlePageFunction = async ({ page, request, response }) => {
                    expect(await response.status()).toBe(200);
                    request.userData.title = await page.title();
                    processed.push(request);
                };

                const playwrightCrawler = new Apify.PlaywrightCrawler({
                    playwrightModule: playwright[browser],
                    requestList: requestListLarge,
                    minConcurrency: 1,
                    maxConcurrency: 1,
                    handlePageFunction,
                    handleFailedRequestFunction: ({ request }) => failed.push(request),
                });

                await requestListLarge.initialize();
                await playwrightCrawler.run();

                expect(playwrightCrawler.autoscaledPool.minConcurrency).toBe(1);
                expect(processed).toHaveLength(6);
                expect(failed).toHaveLength(0);

                processed.forEach((request, id) => {
                    expect(request.url).toEqual(sourcesCopy[id].url);
                    expect(request.userData.title).toBe('Example Domain');
                });
            });
        });
    });
    test('should throw on gotoFunction', async () => {
        try {
            const playwrightCrawler = new Apify.PlaywrightCrawler({ //eslint-disable-line
                requestList,
                maxRequestRetries: 0,
                maxConcurrency: 1,
                handlePageFunction: async () => {
                },
                gotoFunction: () => { },
            });
        } catch (e) {
            expect(e.message.includes('Expected property `gotoFunction` to be of type `undefined`')).toBeTruthy();
        }

        expect.hasAssertions();
    });

    test('should launch with webkit browser', async () => {
        try {
            const playwrightCrawler = new Apify.PlaywrightCrawler({ //eslint-disable-line
                requestList,
                maxRequestRetries: 0,
                maxConcurrency: 1,
                handlePageFunction: async () => {
                },
                gotoFunction: () => { },
            });
        } catch (e) {
            expect(e.message.includes('Expected property `gotoFunction` to be of type `undefined`')).toBeTruthy();
        }

        expect.hasAssertions();
    });

    test('should override goto timeout ', async () => {
        const timeoutSecs = 10;
        let options;
        const playwrightCrawler = new Apify.PlaywrightCrawler({ //eslint-disable-line
            requestList,
            maxRequestRetries: 0,
            maxConcurrency: 1,
            handlePageFunction: async () => {
            },
            preNavigationHooks: [(context, gotoOptions) => {
                options = gotoOptions;
            }],
            gotoTimeoutSecs: timeoutSecs,
        });

        expect(playwrightCrawler.gotoOptions.timeout).toEqual(timeoutSecs * 1000);
        await playwrightCrawler.run();

        expect(options.timeout).toEqual(timeoutSecs * 1000);

        expect.hasAssertions();
    });
});
