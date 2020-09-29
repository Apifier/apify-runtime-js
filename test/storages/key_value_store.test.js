import {
    ENV_VARS,
    KEY_VALUE_STORE_KEYS
} from 'apify-shared/consts';
import { apifyClient } from '../../build/utils';
import {
    KeyValueStore,
    maybeStringify,
} from '../../build/storages/key_value_store';
import StorageManager from '../../build/storages/storage_manager';
import * as Apify from '../../build';
import LocalStorageDirEmulator from '../local_storage_dir_emulator';

//jest.mock('../../build/storages/storage_manager');

describe('KeyValueStore remote', () => {
    let localStorageEmulator;
    let localStorageDir;

    beforeAll(async () => {
        localStorageEmulator = new LocalStorageDirEmulator();
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        localStorageDir = await localStorageEmulator.init();
    });

    afterAll(async () => {
        await localStorageEmulator.destroy();
    });

    test('openKeyValueStore should open storage', async () => {
        const storeName = 'abc';
        const options = { forceCloud: true };
        // This test uses and explains Jest mocking. Under import statements,
        // the StorageManager is immediately mocked. This replaces the class
        // with an observable. We can now call functions that use the class
        // and observe how they interact with StorageManager.
        await Apify.openKeyValueStore(storeName, options);
        // Apify.openRequestQueue creates an instance of StorageManager.
        // Here we check that the constructor was really called once.
        expect(StorageManager).toHaveBeenCalledTimes(1);
        // Jest gives you access to newly created instances of the class.
        // Here we grab the StorageManager instance openRequestQueue created.
        const mockStorageManagerInstance = StorageManager.mock.instances[0];
        // And here we get a reference to the specific instance's function mock.
        const mockOpenStorage = mockStorageManagerInstance.openStorage;
        // Finally, we test that the function was called with expected args.
        expect(mockOpenStorage).toHaveBeenCalledWith(storeName, options);
        expect(mockOpenStorage).toHaveBeenCalledTimes(1);
    });

    test('should work', async () => {
        const store = new KeyValueStore({
            id: 'some-id-1',
            client: apifyClient,
        });

        // Record definition
        const record = { foo: 'bar' };
        const recordStr = JSON.stringify(record, null, 2);

        // Set record
        const mockSetRecord = jest
            .spyOn(store.client, 'setRecord')
            .mockResolvedValueOnce(null);

        await store.setValue('key-1', record);

        expect(mockSetRecord).toHaveBeenCalledTimes(1);
        expect(mockSetRecord).toHaveBeenCalledWith({
            key: 'key-1',
            value: recordStr,
            contentType: 'application/json; charset=utf-8',
        });

        // Get Record
        const mockGetRecord = jest
            .spyOn(store.client, 'getRecord')
            .mockResolvedValueOnce({
                body: record,
                contentType: 'application/json; charset=utf-8',
            });

        const response = await store.getValue('key-1');

        expect(mockGetRecord).toHaveBeenCalledTimes(1);
        expect(mockGetRecord).toHaveBeenCalledWith('key-1');
        expect(response).toEqual(record);

        // Delete Record
        const mockDeleteRecord = jest
            .spyOn(store.client, 'deleteRecord')
            .mockResolvedValueOnce(null);

        await store.setValue('key-1', null);

        expect(mockDeleteRecord).toHaveBeenCalledTimes(1);
        expect(mockDeleteRecord).toHaveBeenCalledWith('key-1');

        // Drop store
        const mockDelete = jest
            .spyOn(store.client, 'delete')
            .mockResolvedValueOnce(undefined);

        await store.drop();

        expect(mockDelete).toHaveBeenCalledTimes(1);
        expect(mockDelete).toHaveBeenLastCalledWith();
    });

    describe('getValue', () => {
        test('throws on invalid args', async () => {
            process.env[ENV_VARS.DEFAULT_KEY_VALUE_STORE_ID] = '1234';
            process.env[ENV_VARS.LOCAL_STORAGE_DIR] = localStorageDir;
            await expect(Apify.getValue()).rejects.toThrow('Expected argument to be of type `string` but received type `undefined`');
            await expect(Apify.getValue({})).rejects.toThrow('Expected argument to be of type `string` but received type `Object`');
            await expect(Apify.getValue(null)).rejects.toThrow('Expected argument to be of type `string` but received type `null`');
            await expect(Apify.getValue('')).rejects.toThrow('Expected string to not be empty');
            delete process.env[ENV_VARS.LOCAL_STORAGE_DIR];
        });

        test(
            'throws if APIFY_DEFAULT_KEY_VALUE_STORE_ID env var is not defined and we use cloud storage',
            async () => {
                delete process.env[ENV_VARS.LOCAL_STORAGE_DIR];
                delete process.env[ENV_VARS.DEFAULT_KEY_VALUE_STORE_ID];
                process.env[ENV_VARS.TOKEN] = 'xxx';

                const errMsg = 'The \'APIFY_DEFAULT_KEY_VALUE_STORE_ID\' environment variable is not defined';
                await expect(Apify.getValue('KEY')).rejects.toThrow(errMsg);

                delete process.env[ENV_VARS.TOKEN];
            },
        );
    });

    describe('setValue', () => {
        test('throws on invalid args', async () => {
            process.env[ENV_VARS.DEFAULT_KEY_VALUE_STORE_ID] = '12345';
            process.env[ENV_VARS.LOCAL_STORAGE_DIR] = localStorageDir;

            await expect(Apify.setValue()).rejects.toThrow('Expected argument to be of type `string` but received type `undefined`');
            await expect(Apify.setValue('', null)).rejects.toThrow('Expected string to not be empty');
            await expect(Apify.setValue('', 'some value')).rejects.toThrow('Expected string to not be empty');
            await expect(Apify.setValue({}, 'some value')).rejects.toThrow('Expected argument to be of type `string` but received type `Object`');
            await expect(Apify.setValue(123, 'some value')).rejects.toThrow('Expected argument to be of type `string` but received type `number`');

            const valueErrMsg = 'The "value" parameter must be a String or Buffer when "options.contentType" is specified';
            await expect(Apify.setValue('key', {}, { contentType: 'image/png' })).rejects.toThrow(valueErrMsg);
            await expect(Apify.setValue('key', 12345, { contentType: 'image/png' })).rejects.toThrow(valueErrMsg);
            await expect(Apify.setValue('key', () => {}, { contentType: 'image/png' })).rejects.toThrow(valueErrMsg);

            await expect(Apify.setValue('key', {}, 123)).rejects.toThrow('Expected argument to be of type `object` but received type `number`');
            await expect(Apify.setValue('key', {}, 'bla/bla')).rejects.toThrow('Expected argument to be of type `object` but received type `string`');
            await expect(Apify.setValue('key', {}, true)).rejects.toThrow('Expected argument to be of type `object` but received type `boolean`');

            const circularObj = {};
            circularObj.xxx = circularObj;
            const circularErrMsg = 'The "value" parameter cannot be stringified to JSON: Converting circular structure to JSON';
            const undefinedErrMsg = 'The "value" parameter was stringified to JSON and returned undefined. '
                + 'Make sure you\'re not trying to stringify an undefined value.';
            await expect(Apify.setValue('key', circularObj)).rejects.toThrow(circularErrMsg);
            await expect(Apify.setValue('key', undefined)).rejects.toThrow(undefinedErrMsg);
            await expect(Apify.setValue('key')).rejects.toThrow(undefinedErrMsg);

            const contTypeRedundantErrMsg = 'Expected property string `contentType` to not be empty in object';
            await expect(Apify.setValue('key', null, { contentType: 'image/png' })).rejects.toThrow('The "value" parameter must be a String or Buffer when "options.contentType" is specified.');
            await expect(Apify.setValue('key', null, { contentType: '' })).rejects.toThrow(contTypeRedundantErrMsg);
            await expect(Apify.setValue('key', null, { contentType: {} }))
                .rejects.toThrow('The "value" parameter must be a String or Buffer when "options.contentType" is specified.');

            await expect(Apify.setValue('key', 'value', { contentType: 123 })).rejects.toThrow('Expected property `contentType` to be of type `string` but received type `number` in object');
            await expect(Apify.setValue('key', 'value', { contentType: {} })).rejects.toThrow('Expected property `contentType` to be of type `string` but received type `Object` in object');
            await expect(Apify.setValue('key', 'value', { contentType: new Date() })).rejects.toThrow('Expected property `contentType` to be of type `string` but received type `Date` in object');
            await expect(Apify.setValue('key', 'value', { contentType: '' }))
                .rejects.toThrow('Expected property string `contentType` to not be empty in object');

            delete process.env[ENV_VARS.LOCAL_STORAGE_DIR];
        });

        test(
            'throws if APIFY_DEFAULT_KEY_VALUE_STORE_ID env var is not defined and we use cloud storage',
            async () => {
                delete process.env[ENV_VARS.DEFAULT_KEY_VALUE_STORE_ID];
                delete process.env[ENV_VARS.LOCAL_STORAGE_DIR];
                process.env[ENV_VARS.TOKEN] = 'xxx';

                const errMsg = 'The \'APIFY_DEFAULT_KEY_VALUE_STORE_ID\' environment variable is not defined';
                await expect(Apify.setValue('KEY', {})).rejects.toThrow(errMsg);

                delete process.env[ENV_VARS.TOKEN];
            },
        );

        test('throws on invalid key', async () => {
            const store = new KeyValueStore({
                id: 'my-store-id',
                client: apifyClient,
            });
            const INVALID_CHARACTERS = '?|\\/"*<>%:';
            let counter = 0;

            for (const char of INVALID_CHARACTERS) { // eslint-disable-line
                try {
                    await store.setValue(`my_id_${char}`, 'value');
                } catch (err) {
                    if (err.message.match('The "key" argument must be at most 256 characters')) counter++;
                }
            }
            expect(counter).toEqual(INVALID_CHARACTERS.length);

            // TODO: This throws "ENAMETOOLONG: name too long, unlink" !!!
            // await store.setValue('X'.repeat(256), 'value');

            // test max length
            try {
                await store.setValue('X'.repeat(257), 'value');
            } catch (err) {
                if (err.message.match('The "key" parameter must be at most 256 characters')) counter++;
            }
        });


        test('correctly adds charset to content type', async () => {
            const store = new KeyValueStore({
                id: 'my-store-id-1',
                client: apifyClient,
            });

            const mockSetRecord = jest
                .spyOn(store.client, 'setRecord')
                .mockResolvedValueOnce(null);

            await store.setValue('key-1', 'xxxx', { contentType: 'text/plain' });

            expect(mockSetRecord).toHaveBeenCalledTimes(1);
            expect(mockSetRecord).toHaveBeenCalledWith({
                key: 'key-1',
                value: 'xxxx',
                contentType: 'text/plain; charset=utf-8',
            });
        });


        test('correctly passes object values as JSON', async () => {
            const store = new KeyValueStore({
                id: 'my-store-id-1',
                client: apifyClient,
            });
            const record = { foo: 'bar' };
            const recordStr = JSON.stringify(record, null, 2);

            const mockSetRecord = jest
                .spyOn(store.client, 'setRecord')
                .mockResolvedValueOnce(null);


            await store.setValue('key-1', record);

            expect(mockSetRecord).toHaveBeenCalledTimes(1);
            expect(mockSetRecord).toHaveBeenCalledWith({
                key: 'key-1',
                value: recordStr,
                contentType: 'application/json; charset=utf-8',
            });
        });

        test('correctly passes raw string values', async () => {
            const store = new KeyValueStore({
                id: 'my-store-id-1',
                client: apifyClient,
            });

            const mockSetRecord = jest
                .spyOn(store.client, 'setRecord')
                .mockResolvedValueOnce(null);

            await store.setValue('key-1', 'xxxx', { contentType: 'text/plain; charset=utf-8' });

            expect(mockSetRecord).toHaveBeenCalledTimes(1);
            expect(mockSetRecord).toHaveBeenCalledWith({
                key: 'key-1',
                value: 'xxxx',
                contentType: 'text/plain; charset=utf-8',
            });
        });

        test('correctly passes raw Buffer values', async () => {
            const store = new KeyValueStore({
                id: 'my-store-id-1',
                client: apifyClient,
            });

            const mockSetRecord = jest
                .spyOn(store.client, 'setRecord')
                .mockResolvedValueOnce(null);

            const value = Buffer.from('some text value');
            await store.setValue('key-1', value, { contentType: 'image/jpeg; charset=something' });

            expect(mockSetRecord).toHaveBeenCalledTimes(1);
            expect(mockSetRecord).toHaveBeenCalledWith({
                key: 'key-1',
                value,
                contentType: 'image/jpeg; charset=something',
            });
        });
    });

    describe('getPublicUrl', () => {
        test('should return the url of a file in apify cloud', async () => {
            process.env[ENV_VARS.TOKEN] = 'xxx';
            const publicUrl = 'https://api.apify.com/v2/key-value-stores';
            const store = new KeyValueStore({
                id: 'my-store-id-1',
                client: apifyClient,
            });

            expect(store.getPublicUrl('file')).toBe(`${publicUrl}/my-store-id-1/records/file`);
            delete process.env[ENV_VARS.TOKEN];
        });
    });

    describe('maybeStringify()', () => {
        test('should work', () => {
            expect(maybeStringify({ foo: 'bar' }, { contentType: null })).toBe('{\n  "foo": "bar"\n}');
            expect(maybeStringify({ foo: 'bar' }, { contentType: undefined })).toBe('{\n  "foo": "bar"\n}');

            expect(maybeStringify('xxx', { contentType: undefined })).toBe('"xxx"');
            expect(maybeStringify('xxx', { contentType: 'something' })).toBe('xxx');

            const obj = {};
            obj.self = obj;
            expect(() => maybeStringify(obj, { contentType: null })).toThrowError(
                'The "value" parameter cannot be stringified to JSON: Converting circular structure to JSON',
            );
        });
    });

    describe('getFileNameRegexp()', () => {

        const getFileNameRegexp = (key) => {
            const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`^${safeKey}\\.[a-z0-9]+$`);
        }

        test('should work', () => {
            const key = 'hel.lo';
            const filenames = [
                'hel.lo.txt', // valid
                'hel.lo.hello.txt',
                'hel.lo.mp3', // valid
                'hel.lo....',
                'hel.lo.hello', // valid
                'hello.hel.lo',
                'hel.lo.',
                '.hel.lo',
                'hel.lo',
                'helXlo.bin',
            ];
            const matched = filenames.reduce((count, name) =>  (getFileNameRegexp(key).test(name) ? ++count : count), 0);
            expect(matched).toBe(3);
        });
    });

    describe('getInput', () => {
        test('should work', async () => {
            process.env[ENV_VARS.LOCAL_STORAGE_DIR] = localStorageDir;
            const defaultStore = await Apify.openKeyValueStore();
            // Uses default value.
            const oldGet = defaultStore.getValue;
            defaultStore.getValue = async (key) => expect(key).toEqual(KEY_VALUE_STORE_KEYS.INPUT);
            await Apify.getInput();

            // Uses value from env var.
            process.env[ENV_VARS.INPUT_KEY] = 'some-value';
            defaultStore.getValue = async (key) => expect(key).toBe('some-value');
            await Apify.getInput();

            delete process.env[ENV_VARS.LOCAL_STORAGE_DIR];
            delete process.env[ENV_VARS.INPUT_KEY];

            defaultStore.getValue = oldGet;
        });
    });

    describe('forEachKey', () => {
        test('should work remotely', async () => {
            const store = new KeyValueStore({
                id: 'my-store-id-1',
                client: apifyClient,
            });

            const mockListKeys = jest.spyOn(store.client, 'listKeys');
            mockListKeys.mockResolvedValueOnce({
                    isTruncated: true,
                    nextExclusiveStartKey: 'key2',
                    items: [
                        { key: 'key1', size: 1 },
                        { key: 'key2', size: 2 },
                    ],
                });

            mockListKeys.mockResolvedValueOnce({
                    isTruncated: true,
                    nextExclusiveStartKey: 'key4',
                    items: [
                        { key: 'key3', size: 3 },
                        { key: 'key4', size: 4 },
                    ],
                });

            const results = [];
            await store.forEachKey(async (key, index, info) => {
                results.push([key, index, info]);
            }, { exclusiveStartKey: 'key0' });

            expect(mockListKeys).toHaveBeenCalledTimes(2);
            expect(mockListKeys).toHaveBeenNthCalledWith(1, { exclusiveStartKey: 'key0' });
            expect(mockListKeys).toHaveBeenNthCalledWith(2, { exclusiveStartKey: 'key4' });

            expect(results).toHaveLength(5);
            results.forEach((r, i) => {
                expect(r[2]).toEqual({ size: i + 1 });
                expect(r[1]).toEqual(i);
                expect(r[0]).toEqual(`key${i + 1}`);
            });
        });

    });
});
