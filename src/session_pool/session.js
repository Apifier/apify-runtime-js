import { cryptoRandomObjectId } from 'apify-shared/utilities';
import log from 'apify-shared/log';
import { checkParamOrThrow } from 'apify-client/build/utils';
import { Cookie, CookieJar } from 'tough-cookie';
import { Cookie as PuppeteerCookie, SameSiteSetting } from 'puppeteer'; // eslint-disable-line import/named,no-unused-vars
import { EventEmitter } from 'events'; // eslint-disable-line no-unused-vars
import EVENTS from './events'; // eslint-disable-line import/named,no-unused-vars
import { STATUS_CODES_BLOCKED } from '../constants';
import { getCookiesFromResponse } from './session_utils';

/**
 * Peristable {Session} state.
 * @typedef {Object} SessionState
 * @property {String} id
 * @property {Object} cookies
 * @property {CookieJar} cookieJar
 * @property {Object} userData
 * @property {Number} maxErrorScore
 * @property {Number} errorScoreDecrement
 * @property {Date} expiresAt
 * @property {Date} createdAt
 * @property {Number} usageCount
 * @property {Number} errorScore
 */

/**
 * @typedef {Object} SessionOptions
 * @property [id] {String} - Id of session used for generating fingerprints. It is used as proxy session name.
 * @property [maxAgeSecs=3000] {Number} - Number of seconds after which the session is considered as expired.
 * @property userData {Object} - Object where custom user data can be stored. For example custom headers.
 * @property [maxErrorScore=3] {number} - Maximum number of marking session as blocked usage.
 *   If the `errorScore` reaches the `maxErrorScore` session is marked as block and it is thrown away.
 *   It starts at 0. Calling the `markBad` function increases the `errorScore` by 1.
 *   Calling the `markGood` will decrease the `errorScore` by `errorScoreDecrement`
 * @property [errorScoreDecrement=0.5] {number} - It is used for healing the session.
 *   For example: if your session is marked bad two times, but it is successful on the third attempt it's errorScore is decremented by this
 *   number.
 * @property createdAt {Date} - Date of creation.
 * @property expiredAt {Date} - Date of expiration.
 * @property [usageCount=0] {Number} - Indicates how many times the session has been used.
 * @property [errorCount=0] {Number} - Indicates how many times the session is marked bad.
 * @property [maxUsageCount=50] {Number} - Session should be used only a limited amount of times.
 *   This number indicates how many times the session is going to be used, before it is thrown away.
 * @property sessionPool {EventEmitter} - SessionPool instance. Session will emit the `sessionRetired` event on this instance.
 */
/**
 *  Sessions are used to store information such as cookies and can be used for generating fingerprints and proxy sessions.
 *  You can imagine each session as a specific user, with its own cookies, IP (via proxy) and potentially a unique browser fingerprint.
 *  Session internal state can be enriched with custom user data for example some authorization tokens and specific headers in general.
 */
export class Session {
    /**
     * Session configuration.
     * @param {SessionOptions} options
     */
    constructor(options = {}) {
        const {
            id = `session_${cryptoRandomObjectId(10)}`,
            cookies = [], // @TODO: Delete, deprecate or leave it as custom cookie persistance?
            cookieJar = new CookieJar(),
            maxAgeSecs = 3000,
            userData = {},
            maxErrorScore = 3,
            errorScoreDecrement = 0.5,
            createdAt = new Date(),
            usageCount = 0,
            errorScore = 0,
            maxUsageCount = 50,
            sessionPool,
        } = options;

        const { expiresAt = new Date(Date.now() + (maxAgeSecs * 1000)) } = options;

        // Validation
        checkParamOrThrow(id, 'options.id', 'String');
        checkParamOrThrow(maxAgeSecs, 'options.maxAgeSecs', 'Number');
        checkParamOrThrow(userData, 'options.userData', 'Object');
        checkParamOrThrow(maxErrorScore, 'options.maxErrorScore', 'Number');
        checkParamOrThrow(expiresAt, 'options.expiresAt', 'Maybe Date');
        checkParamOrThrow(createdAt, 'options.createdAt', 'Date');
        checkParamOrThrow(usageCount, 'options.usageCount', 'Number');
        checkParamOrThrow(errorScore, 'options.errorScore', 'Number');
        checkParamOrThrow(maxUsageCount, 'options.maxUsageCount', 'Number');
        checkParamOrThrow(sessionPool, 'options.sessionPool', 'Object');

        // sessionPool must be instance of SessionPool.
        if (sessionPool.constructor.name !== 'SessionPool') {
            throw new Error('Session: sessionPool must be instance of SessionPool');
        }

        // Configurable
        this.id = id;
        this.cookies = cookies;
        /** @type CookieJar */
        this.cookieJar = cookieJar.setCookie ? cookieJar : CookieJar.fromJSON(JSON.stringify(cookieJar));
        this.maxAgeSecs = maxAgeSecs;
        this.userData = userData;
        this.maxErrorScore = maxErrorScore;
        this.errorScoreDecrement = errorScoreDecrement;

        // Internal
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
        this.usageCount = usageCount; // indicates how many times the session has been used
        this.errorScore = errorScore; // indicates number of markBaded request with the session
        this.maxUsageCount = maxUsageCount;
        this.sessionPool = sessionPool;
    }

    /**
     * indicates whether the session is blocked.
     * Session is blocked once it reaches the `maxErrorScore`.
     * @return {boolean}
     */
    isBlocked() {
        return this.errorScore >= this.maxErrorScore;
    }

    /**
     * Indicates whether the session is expired.
     * Session expiration is determined by the `maxAgeSecs`.
     * Once the session is older than `createdAt + maxAgeSecs` the session is considered expired.
     * @return {boolean}
     */
    isExpired() {
        return this.expiresAt <= new Date();
    }

    /**
     * Indicates whether the session is used maximum number of times.
     * Session maximum usage count can be changed by `maxUsageCount` parameter.
     * @return {boolean}
     */
    isMaxUsageCountReached() {
        return this.usageCount >= this.maxUsageCount;
    }

    /**
     * Indicates whether the session can be used for next requests.
     * Session is usable when it is not expired, not blocked and the maximum usage count has not be reached.
     * @return {boolean}
     */
    isUsable() {
        return !this.isBlocked() && !this.isExpired() && !this.isMaxUsageCountReached();
    }

    /**
     * This method should be called after a successful session usage.
     * It increases `usageCount` and potentially lowers the `errorScore` by the `errorScoreDecrement`.
     */
    markGood() {
        this.usageCount += 1;

        if (this.errorScore > 0) {
            this.errorScore -= this.errorScoreDecrement;
        }
    }

    /**
     * Gets session state for persistence in KeyValueStore.
     * @return {SessionState} represents session internal state.
     */
    getState() {
        return {
            id: this.id,
            cookies: this.cookies,
            cookieJar: this.cookieJar.toJSON(),
            userData: this.userData,
            maxErrorScore: this.maxErrorScore,
            errorScoreDecrement: this.errorScoreDecrement,
            expiresAt: this.expiresAt.toISOString(),
            createdAt: this.createdAt.toISOString(),
            usageCount: this.usageCount,
            errorScore: this.errorScore,
        };
    }

    /**
     * Marks session as blocked and emits event on the `SessionPool`
     * This method should be used if the session usage was unsuccessful
     * and you are sure that it is because of the session configuration and not any external matters.
     * For example when server returns 403 status code.
     * If the session does not work due to some external factors as server error such as 5XX you probably want to use `markBad` method.
     */
    retire() {
        // mark it as an invalid by increasing the error score count.
        this.errorScore += this.maxErrorScore;
        this.usageCount += 1;

        // emit event so we can retire browser in puppeteer pool
        this.sessionPool.emit(EVENTS.SESSION_RETIRED, this);
    }

    /**
     * Increases usage and error count.
     * Should be used when the session has been used unsuccessfully. For example because of timeouts.
     */
    markBad() {
        this.errorScore += 1;
        this.usageCount += 1;
    }

    /**
     * Retires session based on status code.
     * @param statusCode {Number} - HTTP status code
     * @param blockedStatusCodes {Array<Number>} - Custom HTTP status codes that means blocking on particular website.
     * @return {boolean} whether the session was retired.
     */
    retireOnBlockedStatusCodes(statusCode, blockedStatusCodes = []) {
        const isBlocked = STATUS_CODES_BLOCKED.concat(blockedStatusCodes).includes(statusCode);
        if (isBlocked) {
            this.retire();
        }
        return isBlocked;
    }

    /**
     * Sets cookies from response to the cookieJar.
     * Parses cookies from `set-cookie` header and sets them to `Session.cookieJar`.
     * @param {{ headers }} response
     */
    setCookiesFromResponse(response) {
        try {
            const cookies = getCookiesFromResponse(response).filter(c => c);

            this._setCookies(cookies, response.url);
        } catch (e) {
            // if invalid Cookie header is provided just log the exception.
            log.exception(e, 'Session: Could not get cookies from response');
        }
    }

    /**
     * Persists puppeteer cookies to session for reuse.
     * @param {PuppeteerCookie} puppeteerCookies - cookie from puppeteer `page.cookies` method.
     * @param {String} url - Loaded url from page function.
     */
    putPuppeteerCookies(puppeteerCookies, url) {
        const cookies = puppeteerCookies.map(puppeteerCookie => this._transformPuppeteerCookie(puppeteerCookie));

        this.setCookies(cookies, url);
    }

    /**
     * Set cookies to session cookieJar.
     * Cookies array should be [puppeteer](https://pptr.dev/#?product=Puppeteer&version=v2.0.0&show=api-pagecookiesurls) cookie compatible.
     * @param cookies {Array<PuppeteerCookie>}
     * @param url {String}
     */
    setPuppeteerCookies(cookies, url) {
        try {
            this._setCookies(cookies.map(this._puppeteerCookieToTough), url);
        } catch (e) {
            // if invalid cookies are provided just log the exception. No need to retry the request automatically.
            log.exception(e, 'Session: Could not set cookies in puppeteer format.');
        }
    }

    /**
     * Gets cookies in puppeteer ready to be used with `page.setCookie`.
     * @param url {String} - website url. Only cookies stored for this url will be returned
     * @return {Array<PuppeteerCookie>}
     */
    getPuppeteerCookies(url) {
        const cookies = this.cookieJar.getCookiesSync(url);

        return cookies.map(this._toughCookieToPuppeteer);
    }

    /**
     * Wrapper around `tough-cookie` Cookie jar `getCookieString` method.
     * @param {String} url
     * @return {String} - represents `Cookie` header.
     */
    getCookieString(url) {
        return this.cookieJar.getCookieStringSync(url, {});
    }


    /**
     *  Transforms puppeteer cookie to tough-cookie.
     * @param puppeteerCookie {PuppeteerCookie} - Cookie from puppeteer `page.cookies method.
     * @return {Cookie}
     * @private
     */
    _puppeteerCookieToTough(puppeteerCookie) {
        return new Cookie({
            key: puppeteerCookie.name,
            value: puppeteerCookie.value,
            expires: new Date(puppeteerCookie.expires),
            domain: puppeteerCookie.domain,
            path: puppeteerCookie.path,
            secure: puppeteerCookie.secure,
            httpOnly: puppeteerCookie.httpOnly,
        });
    }

    /**
     *  Transforms tough-cookie cookie to puppeteer Cookie .
     * @param {Cookie} toughCookie - Cookie from CookieJar.
     * @return {PuppeteerCookie} - puppeteer cookie
     * @private
     */
    _toughCookieToPuppeteer(toughCookie) {
        return {
            name: toughCookie.key,
            value: toughCookie.value,
            expires: new Date(toughCookie.expires).getTime(),
            domain: toughCookie.domain,
            path: toughCookie.path,
            secure: toughCookie.secure,
            httpOnly: toughCookie.httpOnly,
        };
    }

    /**
     * Sets cookies.
     * @param {Cookie} cookies
     * @param {String} url
     * @private
     */
    _setCookies(cookies, url) {
        for (const cookie of cookies) {
            this.cookieJar.setCookieSync(cookie, url, { ignoreError: false });
        }
    }
}
