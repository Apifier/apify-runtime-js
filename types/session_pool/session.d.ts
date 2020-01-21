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
 * @property [createdAt] {Date} - Date of creation.
 * @property [expiredAt] {Date} - Date of expiration.
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
    constructor(options?: SessionOptions);
    id: string;
    cookies: any;
    /** @type CookieJar */
    cookieJar: CookieJar;
    maxAgeSecs: number;
    userData: any;
    maxErrorScore: number;
    errorScoreDecrement: number;
    expiresAt: any;
    createdAt: Date;
    usageCount: number;
    errorScore: any;
    maxUsageCount: number;
    sessionPool: EventEmitter;
    /**
     * indicates whether the session is blocked.
     * Session is blocked once it reaches the `maxErrorScore`.
     * @return {boolean}
     */
    isBlocked(): boolean;
    /**
     * Indicates whether the session is expired.
     * Session expiration is determined by the `maxAgeSecs`.
     * Once the session is older than `createdAt + maxAgeSecs` the session is considered expired.
     * @return {boolean}
     */
    isExpired(): boolean;
    /**
     * Indicates whether the session is used maximum number of times.
     * Session maximum usage count can be changed by `maxUsageCount` parameter.
     * @return {boolean}
     */
    isMaxUsageCountReached(): boolean;
    /**
     * Indicates whether the session can be used for next requests.
     * Session is usable when it is not expired, not blocked and the maximum usage count has not be reached.
     * @return {boolean}
     */
    isUsable(): boolean;
    /**
     * This method should be called after a successful session usage.
     * It increases `usageCount` and potentially lowers the `errorScore` by the `errorScoreDecrement`.
     */
    markGood(): void;
    /**
     * Gets session state for persistence in KeyValueStore.
     * @return {SessionState} represents session internal state.
     */
    getState(): SessionState;
    /**
     * Marks session as blocked and emits event on the `SessionPool`
     * This method should be used if the session usage was unsuccessful
     * and you are sure that it is because of the session configuration and not any external matters.
     * For example when server returns 403 status code.
     * If the session does not work due to some external factors as server error such as 5XX you probably want to use `markBad` method.
     */
    retire(): void;
    /**
     * Increases usage and error count.
     * Should be used when the session has been used unsuccessfully. For example because of timeouts.
     */
    markBad(): void;
    /**
     * Retires session based on status code.
     * @param statusCode {Number} - HTTP status code
     * @return {boolean} whether the session was retired.
     */
    checkStatus(statusCode: number): boolean;
    /**
     * Sets cookies from response to the cookieJar.
     * Parses cookies from `set-cookie` header and sets them to `Session.cookieJar`.
     * @param {{ headers }} response
     */
    setCookiesFromResponse(response: {
        headers: any;
    }): void;
    /**
     * Persists puppeteer cookies to session for reuse.
     * @param {PuppeteerCookie} puppeteerCookies - cookie from puppeteer `page.cookies` method.
     * @param {String} url - Loaded url from page function.
     */
    putPuppeteerCookies(puppeteerCookies: PuppeteerCookie, url: string): void;
    /**
     * Set cookies to session cookieJar.
     * Cookies array should be [puppeteer](https://pptr.dev/#?product=Puppeteer&version=v2.0.0&show=api-pagecookiesurls) cookie compatible.
     * @param cookies {Array<PuppeteerCookie>}
     * @param url {String}
     */
    setPuppeteerCookies(cookies: PuppeteerCookie[], url: string): void;
    /**
     * Gets cookies in puppeteer ready to be used with `page.setCookie`.
     * @param url {String} - website url. Only cookies stored for this url will be returned
     * @return {Array<PuppeteerCookie>}
     */
    getPuppeteerCookies(url: string): PuppeteerCookie[];
    /**
     * Wrapper around `tough-cookie` Cookie jar `getCookieString` method.
     * @param {String} url
     * @return {String} - represents `Cookie` header.
     */
    getCookieString(url: string): string;
    /**
     *  Transforms puppeteer cookie to tough-cookie.
     * @param puppeteerCookie {PuppeteerCookie} - Cookie from puppeteer `page.cookies method.
     * @return {Cookie}
     * @private
     */
    _puppeteerCookieToTough(puppeteerCookie: PuppeteerCookie): Cookie;
    /**
     *  Transforms tough-cookie cookie to puppeteer Cookie .
     * @param {Cookie} toughCookie - Cookie from CookieJar.
     * @return {PuppeteerCookie} - puppeteer cookie
     * @private
     */
    _toughCookieToPuppeteer(toughCookie: Cookie): PuppeteerCookie;
    /**
     * Sets cookies.
     * @param {Cookie} cookies
     * @param {String} url
     * @private
     */
    _setCookies(cookies: Cookie, url: string): void;
}
/**
 * Peristable {Session} state.
 */
export type SessionState = {
    id: string;
    cookies: any;
    cookieJar: CookieJar;
    userData: any;
    maxErrorScore: number;
    errorScoreDecrement: number;
    expiresAt: Date;
    createdAt: Date;
    usageCount: number;
    errorScore: number;
};
export type SessionOptions = {
    /**
     * - Id of session used for generating fingerprints. It is used as proxy session name.
     */
    id?: string;
    /**
     * - Number of seconds after which the session is considered as expired.
     */
    maxAgeSecs?: number;
    /**
     * - Object where custom user data can be stored. For example custom headers.
     */
    userData: any;
    /**
     * - Maximum number of marking session as blocked usage.
     * If the `errorScore` reaches the `maxErrorScore` session is marked as block and it is thrown away.
     * It starts at 0. Calling the `markBad` function increases the `errorScore` by 1.
     * Calling the `markGood` will decrease the `errorScore` by `errorScoreDecrement`
     */
    maxErrorScore?: number;
    /**
     * - It is used for healing the session.
     * For example: if your session is marked bad two times, but it is successful on the third attempt it's errorScore is decremented by this
     * number.
     */
    errorScoreDecrement?: number;
    /**
     * - Date of creation.
     */
    createdAt?: Date;
    /**
     * - Date of expiration.
     */
    expiredAt?: Date;
    /**
     * - Indicates how many times the session has been used.
     */
    usageCount?: number;
    /**
     * - Indicates how many times the session is marked bad.
     */
    errorCount?: number;
    /**
     * - Session should be used only a limited amount of times.
     * This number indicates how many times the session is going to be used, before it is thrown away.
     */
    maxUsageCount?: number;
    /**
     * - SessionPool instance. Session will emit the `sessionRetired` event on this instance.
     */
    sessionPool: EventEmitter;
};
import { CookieJar } from "tough-cookie";
import { EventEmitter } from "node/events";
import { Cookie as PuppeteerCookie } from "puppeteer";
import { Cookie } from "tough-cookie";
