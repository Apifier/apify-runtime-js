/// <reference types="node" />
export default CheerioCrawler;
export type CheerioCrawlerOptions<RequestUserData, SessionUserData> = {
    /**
     * User-provided function that performs the logic of the crawler. It is called for each page
     * loaded and parsed by the crawler.
     *
     * The function receives the following object as an argument:
     * ```
     * {
     * $: Cheerio, // the Cheerio object with parsed HTML
     * body: String|Buffer // the request body of the web page
     * // the parsed object from JSON string
     * // if the response contains the content type application/json
     * json: Object,
     * request: Request,
     * contentType: Object, // Parsed Content-Type header: { type, encoding }
     * response: Object // An instance of Node's http.IncomingMessage object,
     * autoscaledPool: AutoscaledPool,
     * session: Session
     * }
     * ```
     * Type of `body` depends on web page `Content-Type` header.
     * - String for `text/html`, `application/xhtml+xml`, `application/xml` mime types
     * - Buffer for others mime types
     *
     * Parsed `Content-Type` header using
     * <a href="https://www.npmjs.com/package/content-type" target="_blank">content-type package</a>
     * is stored in `contentType`.
     *
     * Cheerio is available only for HTML and XML content types.
     *
     * With the {@link Request} object representing the URL to crawl.
     *
     * If the function returns, the returned promise is awaited by the crawler.
     *
     * If the function throws an exception, the crawler will try to re-crawl the
     * request later, up to `option.maxRequestRetries` times.
     * If all the retries fail, the crawler calls the function
     * provided to the `handleFailedRequestFunction` parameter.
     * To make this work, you should **always**
     * let your function throw exceptions rather than catch them.
     * The exceptions are logged to the request using the
     * [`request.pushErrorMessage`](request#Request+pushErrorMessage) function.
     */
    handlePageFunction: CheerioHandlePage<RequestUserData, SessionUserData>;
    /**
     * Static list of URLs to be processed.
     * Either `requestList` or `requestQueue` option must be provided (or both).
     */
    requestList?: RequestList;
    /**
     * Dynamic queue of URLs to be processed. This is useful for recursive crawling of websites.
     * Either `requestList` or `requestQueue` option must be provided (or both).
     */
    requestQueue?: RequestQueue<RequestUserData>;
    /**
     * Represents the options passed to
     * <a href="https://www.npmjs.com/package/request" target="_blank">request</a> to make the HTTP call.
     * Provided `requestOptions` are added to internal defaults that cannot be overridden to ensure
     * the operation of `CheerioCrawler` and all its options. Headers will not be merged,
     * use {@link RequestList} and/or {@link RequestQueue} to initialize your {@link Request} with the
     * correct headers or use `prepareRequestFunction` to modify your {@link Request} dynamically.
     * If you need more granular control over your requests, use {@link BasicCrawler}.
     *
     * The mandatory internal defaults that **CANNOT BE OVERRIDDEN** by `requestOptions`:
     * ```
     * {
     * url,       // Provided by RequestList and/or RequestQueue
     * method,    // Provided by RequestList and/or RequestQueue
     * headers,   // Provided by RequestList and/or RequestQueue
     * payload,   // Provided by RequestList and/or RequestQueue
     * strictSSL, // Use ignoreSslErrors
     * proxy,     // Use useApifyProxy or proxyUrls
     * }
     * ```
     */
    requestOptions?: utilsRequest.RequestAsBrowserOptions;
    /**
     * A function that executes before the HTTP request is made to the target resource.
     * This function is suitable for setting dynamic properties such as cookies to the {@link Request}.
     *
     * The function receives the following object as an argument:
     * ```
     * {
     * request: Request,
     * session: Session
     * }
     * ```
     * where the {@link Request} instance corresponds to the initialized request
     * and the {@link Session} instance corresponds to used session.
     *
     * The function should modify the properties of the passed {@link Request} instance
     * in place because there are already earlier references to it. Making a copy and returning it from
     * this function is therefore not supported, because it would create inconsistencies where
     * different parts of SDK would have access to a different {@link Request} instance.
     */
    prepareRequestFunction?: PrepareRequest<RequestUserData>;
    /**
     * Timeout in which the function passed as `handlePageFunction` needs to finish, given in seconds.
     */
    handlePageTimeoutSecs?: number;
    /**
     * Timeout in which the HTTP request to the resource needs to finish, given in seconds.
     */
    requestTimeoutSecs?: number;
    /**
     * If set to true, SSL certificate errors will be ignored.
     */
    ignoreSslErrors?: boolean;
    /**
     * If set to `true`, `CheerioCrawler` will be configured to use
     * <a href="https://my.apify.com/proxy" target="_blank">Apify Proxy</a> for all connections.
     * For more information, see the <a href="https://docs.apify.com/proxy" target="_blank">documentation</a>
     */
    useApifyProxy?: boolean;
    /**
     * An array of proxy groups to be used
     * by the <a href="https://docs.apify.com/proxy" target="_blank">Apify Proxy</a>.
     * Only applied if the `useApifyProxy` option is `true`.
     */
    apifyProxyGroups?: string[];
    /**
     * Apify Proxy session identifier to be used with requests made by `CheerioCrawler`.
     * All HTTP requests going through the proxy with the same session identifier
     * will use the same target proxy server (i.e. the same IP address).
     * The identifier can only contain the following characters: `0-9`, `a-z`, `A-Z`, `"."`, `"_"` and `"~"`.
     * Only applied if the `useApifyProxy` option is `true`.
     */
    apifyProxySession?: string;
    /**
     * An array of custom proxy URLs to be used by the `CheerioCrawler` instance.
     * The provided custom proxies' order will be randomized and the resulting list rotated.
     * Custom proxies are not compatible with Apify Proxy and an attempt to use both
     * configuration options will cause an error to be thrown on startup.
     */
    proxyUrls?: string[];
    /**
     * A function to handle requests that failed more than `option.maxRequestRetries` times.
     *
     * The function receives the following object as an argument:
     * ```
     * {
     * request: Request,
     * error: Error,
     * }
     * ```
     * where the {@link Request} instance corresponds to the failed request, and the `Error` instance
     * represents the last error thrown during processing of the request.
     *
     * See <a href="https://github.com/apifytech/apify-js/blob/master/src/crawlers/cheerio_crawler.js#L13">source code</a>
     * for the default implementation of this function.
     */
    handleFailedRequestFunction?: HandleFailedRequest;
    /**
     * An array of <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types"
     * target="_blank">MIME types</a> you want the crawler to load and process.
     * By default, only `text/html` and `application/xhtml+xml` MIME types are supported.
     */
    additionalMimeTypes?: string[];
    /**
     * Indicates how many times the request is retried if either `requestFunction` or `handlePageFunction` fails.
     */
    maxRequestRetries?: number;
    /**
     * Maximum number of pages that the crawler will open. The crawl will stop when this limit is reached.
     * Always set this value in order to prevent infinite loops in misconfigured crawlers.
     * Note that in cases of parallel crawling, the actual number of pages visited might be slightly higher than this value.
     */
    maxRequestsPerCrawl?: number;
    /**
     * Custom options passed to the underlying {@link AutoscaledPool} constructor.
     * Note that the `runTaskFunction`, `isTaskReadyFunction` and `isFinishedFunction` options
     * are provided by `CheerioCrawler` and cannot be overridden. Reasonable {@link Snapshotter}
     * and {@link SystemStatus} defaults are provided to account for the fact that `cheerio`
     * parses HTML synchronously and therefore blocks the event loop.
     */
    autoscaledPoolOptions?: AutoscaledPoolOptions;
    /**
     * Sets the minimum concurrency (parallelism) for the crawl. Shortcut to the corresponding {@link AutoscaledPool} option.
     *
     * *WARNING:* If you set this value too high with respect to the available system memory and CPU, your crawler will run extremely slow or crash.
     * If you're not sure, just keep the default value and the concurrency will scale up automatically.
     */
    minConcurrency?: number;
    /**
     * Sets the maximum concurrency (parallelism) for the crawl. Shortcut to the corresponding {@link AutoscaledPool} option.
     */
    maxConcurrency?: number;
    /**
     * If set to true Crawler will automatically use Session Pool. It will automatically retire sessions on 403, 401 and 429 status codes.
     * It also marks Session as bad after a request timeout.
     */
    useSessionPool?: boolean;
    /**
     * Custom options passed to the underlying {@link SessionPool} constructor.
     */
    sessionPoolOptions?: SessionPoolOptions<SessionUserData>;
    /**
     * Automatically saves cookies to Session. Works only if Session Pool is used.
     *
     * It parses cookie from response "set-cookie" header saves or updates cookies for session and once the session is used for next request.
     * It passes the "Cookie" header to the request with the session cookies.
     */
    persistCookiesPerSession?: boolean;
};
export type PrepareRequestInputs<RequestUserData> = {
    /**
     * Original instance fo the {Request} object. Must be modified in-place.
     */
    request: Request<RequestUserData>;
};
export type PrepareRequest<RequestUserData> = (inputs: PrepareRequestInputs<RequestUserData>) => void | Promise<void>;
export type CheerioHandlePageInputs<RequestUserData, SessionUserData> = {
    /**
     * The <a href="https://cheerio.js.org/">Cheerio</a> object with parsed HTML.
     */
    $?: CheerioStatic;
    /**
     * The request body of the web page.
     */
    body: string | Buffer;
    /**
     * The parsed object from JSON string if the response contains the content type application/json.
     */
    json?: any;
    /**
     * The original {Request} object.
     */
    request: Request<RequestUserData>;
    /**
     * Parsed `Content-Type header: { type, encoding }`.
     */
    contentType: {
        type: string;
        encoding: string;
    };
    /**
     * An instance of Node's http.IncomingMessage object,
     */
    response: IncomingMessage;
    autoscaledPool: AutoscaledPool;
    session?: Session<SessionUserData>;
};
export type CheerioHandlePage<RequestUserData, SessionUserData> = (inputs: CheerioHandlePageInputs<RequestUserData, SessionUserData>) => Promise<void>;
/**
 * @template RequestUserData
 * @template SessionUserData
 * @typedef CheerioCrawlerOptions
 * @property {CheerioHandlePage<RequestUserData, SessionUserData>} handlePageFunction
 *   User-provided function that performs the logic of the crawler. It is called for each page
 *   loaded and parsed by the crawler.
 *
 *   The function receives the following object as an argument:
 * ```
 * {
 *   $: Cheerio, // the Cheerio object with parsed HTML
 *   body: String|Buffer // the request body of the web page
 *   // the parsed object from JSON string
 *   // if the response contains the content type application/json
 *   json: Object,
 *   request: Request,
 *   contentType: Object, // Parsed Content-Type header: { type, encoding }
 *   response: Object // An instance of Node's http.IncomingMessage object,
 *   autoscaledPool: AutoscaledPool,
 *   session: Session
 * }
 * ```
 *   Type of `body` depends on web page `Content-Type` header.
 *   - String for `text/html`, `application/xhtml+xml`, `application/xml` mime types
 *   - Buffer for others mime types
 *
 *   Parsed `Content-Type` header using
 *   <a href="https://www.npmjs.com/package/content-type" target="_blank">content-type package</a>
 *   is stored in `contentType`.
 *
 *   Cheerio is available only for HTML and XML content types.
 *
 *   With the {@link Request} object representing the URL to crawl.
 *
 *   If the function returns, the returned promise is awaited by the crawler.
 *
 *   If the function throws an exception, the crawler will try to re-crawl the
 *   request later, up to `option.maxRequestRetries` times.
 *   If all the retries fail, the crawler calls the function
 *   provided to the `handleFailedRequestFunction` parameter.
 *   To make this work, you should **always**
 *   let your function throw exceptions rather than catch them.
 *   The exceptions are logged to the request using the
 *   [`request.pushErrorMessage`](request#Request+pushErrorMessage) function.
 * @property {RequestList} [requestList]
 *   Static list of URLs to be processed.
 *   Either `requestList` or `requestQueue` option must be provided (or both).
 * @property {RequestQueue<RequestUserData>} [requestQueue]
 *   Dynamic queue of URLs to be processed. This is useful for recursive crawling of websites.
 *   Either `requestList` or `requestQueue` option must be provided (or both).
 * @property {RequestAsBrowserOptions} [requestOptions]
 *   Represents the options passed to
 *   <a href="https://www.npmjs.com/package/request" target="_blank">request</a> to make the HTTP call.
 *   Provided `requestOptions` are added to internal defaults that cannot be overridden to ensure
 *   the operation of `CheerioCrawler` and all its options. Headers will not be merged,
 *   use {@link RequestList} and/or {@link RequestQueue} to initialize your {@link Request} with the
 *   correct headers or use `prepareRequestFunction` to modify your {@link Request} dynamically.
 *   If you need more granular control over your requests, use {@link BasicCrawler}.
 *
 *   The mandatory internal defaults that **CANNOT BE OVERRIDDEN** by `requestOptions`:
 *   ```
 *   {
 *       url,       // Provided by RequestList and/or RequestQueue
 *       method,    // Provided by RequestList and/or RequestQueue
 *       headers,   // Provided by RequestList and/or RequestQueue
 *       payload,   // Provided by RequestList and/or RequestQueue
 *       strictSSL, // Use ignoreSslErrors
 *       proxy,     // Use useApifyProxy or proxyUrls
 *   }
 *   ```
 * @property {PrepareRequest<RequestUserData>} [prepareRequestFunction]
 *   A function that executes before the HTTP request is made to the target resource.
 *   This function is suitable for setting dynamic properties such as cookies to the {@link Request}.
 *
 *   The function receives the following object as an argument:
 * ```
 * {
 *   request: Request,
 *   session: Session
 * }
 * ```
 *   where the {@link Request} instance corresponds to the initialized request
 *   and the {@link Session} instance corresponds to used session.
 *
 *   The function should modify the properties of the passed {@link Request} instance
 *   in place because there are already earlier references to it. Making a copy and returning it from
 *   this function is therefore not supported, because it would create inconsistencies where
 *   different parts of SDK would have access to a different {@link Request} instance.
 *
 * @property {number} [handlePageTimeoutSecs=60]
 *   Timeout in which the function passed as `handlePageFunction` needs to finish, given in seconds.
 * @property {number} [requestTimeoutSecs=30]
 *   Timeout in which the HTTP request to the resource needs to finish, given in seconds.
 * @property {boolean} [ignoreSslErrors=true]
 *   If set to true, SSL certificate errors will be ignored.
 * @property {boolean} [useApifyProxy=false]
 *   If set to `true`, `CheerioCrawler` will be configured to use
 *   <a href="https://my.apify.com/proxy" target="_blank">Apify Proxy</a> for all connections.
 *   For more information, see the <a href="https://docs.apify.com/proxy" target="_blank">documentation</a>
 * @property {string[]} [apifyProxyGroups]
 *   An array of proxy groups to be used
 *   by the <a href="https://docs.apify.com/proxy" target="_blank">Apify Proxy</a>.
 *   Only applied if the `useApifyProxy` option is `true`.
 * @property {string} [apifyProxySession]
 *   Apify Proxy session identifier to be used with requests made by `CheerioCrawler`.
 *   All HTTP requests going through the proxy with the same session identifier
 *   will use the same target proxy server (i.e. the same IP address).
 *   The identifier can only contain the following characters: `0-9`, `a-z`, `A-Z`, `"."`, `"_"` and `"~"`.
 *   Only applied if the `useApifyProxy` option is `true`.
 * @property {string[]} [proxyUrls]
 *   An array of custom proxy URLs to be used by the `CheerioCrawler` instance.
 *   The provided custom proxies' order will be randomized and the resulting list rotated.
 *   Custom proxies are not compatible with Apify Proxy and an attempt to use both
 *   configuration options will cause an error to be thrown on startup.
 * @property {HandleFailedRequest} [handleFailedRequestFunction]
 *   A function to handle requests that failed more than `option.maxRequestRetries` times.
 *
 *   The function receives the following object as an argument:
 * ```
 * {
 *   request: Request,
 *   error: Error,
 * }
 * ```
 *   where the {@link Request} instance corresponds to the failed request, and the `Error` instance
 *   represents the last error thrown during processing of the request.
 *
 *   See <a href="https://github.com/apifytech/apify-js/blob/master/src/crawlers/cheerio_crawler.js#L13">source code</a>
 *   for the default implementation of this function.
 * @property {string[]} [additionalMimeTypes]
 *   An array of <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types"
 *   target="_blank">MIME types</a> you want the crawler to load and process.
 *   By default, only `text/html` and `application/xhtml+xml` MIME types are supported.
 * @property {number} [maxRequestRetries=3]
 *   Indicates how many times the request is retried if either `requestFunction` or `handlePageFunction` fails.
 * @property {number} [maxRequestsPerCrawl]
 *   Maximum number of pages that the crawler will open. The crawl will stop when this limit is reached.
 *   Always set this value in order to prevent infinite loops in misconfigured crawlers.
 *   Note that in cases of parallel crawling, the actual number of pages visited might be slightly higher than this value.
 * @property {AutoscaledPoolOptions} [autoscaledPoolOptions]
 *   Custom options passed to the underlying {@link AutoscaledPool} constructor.
 *   Note that the `runTaskFunction`, `isTaskReadyFunction` and `isFinishedFunction` options
 *   are provided by `CheerioCrawler` and cannot be overridden. Reasonable {@link Snapshotter}
 *   and {@link SystemStatus} defaults are provided to account for the fact that `cheerio`
 *   parses HTML synchronously and therefore blocks the event loop.
 * @property {number} [minConcurrency=1]
 *   Sets the minimum concurrency (parallelism) for the crawl. Shortcut to the corresponding {@link AutoscaledPool} option.
 *
 *   *WARNING:* If you set this value too high with respect to the available system memory and CPU, your crawler will run extremely slow or crash.
 *   If you're not sure, just keep the default value and the concurrency will scale up automatically.
 * @property {number} [maxConcurrency=1000]
 *   Sets the maximum concurrency (parallelism) for the crawl. Shortcut to the corresponding {@link AutoscaledPool} option.
 * @property {boolean} [useSessionPool=false]
 *   If set to true Crawler will automatically use Session Pool. It will automatically retire sessions on 403, 401 and 429 status codes.
 *   It also marks Session as bad after a request timeout.
 * @property {SessionPoolOptions<SessionUserData>} [sessionPoolOptions]
 *   Custom options passed to the underlying {@link SessionPool} constructor.
 * @property {boolean} [persistCookiesPerSession]
 *   Automatically saves cookies to Session. Works only if Session Pool is used.
 *
 *   It parses cookie from response "set-cookie" header saves or updates cookies for session and once the session is used for next request.
 *   It passes the "Cookie" header to the request with the session cookies.
 */
/**
 * Provides a framework for the parallel crawling of web pages using plain HTTP requests and
 * <a href="https://www.npmjs.com/package/cheerio" target="_blank">cheerio</a> HTML parser.
 * The URLs to crawl are fed either from a static list of URLs
 * or from a dynamic queue of URLs enabling recursive crawling of websites.
 *
 * Since `CheerioCrawler` uses raw HTTP requests to download web pages,
 * it is very fast and efficient on data bandwidth. However, if the target website requires JavaScript
 * to display the content, you might need to use {@link PuppeteerCrawler} instead,
 * because it loads the pages using full-featured headless Chrome browser.
 *
 * `CheerioCrawler` downloads each URL using a plain HTTP request,
 * parses the HTML content using <a href="https://www.npmjs.com/package/cheerio" target="_blank">Cheerio</a>
 * and then invokes the user-provided [`handlePageFunction()`](#new_CheerioCrawler_new) to extract page data
 * using a <a href="https://jquery.com/" target="_blank">jQuery</a>-like interface to the parsed HTML DOM.
 *
 * The source URLs are represented using {@link Request} objects that are fed from
 * {@link RequestList} or {@link RequestQueue} instances provided by the [`requestList`](#new_CheerioCrawler_new)
 * or [`requestQueue`](#new_CheerioCrawler_new) constructor options, respectively.
 *
 * If both [`requestList`](#new_CheerioCrawler_new) and [`requestQueue`](#new_CheerioCrawler_new) are used,
 * the instance first processes URLs from the {@link RequestList} and automatically enqueues all of them
 * to {@link RequestQueue} before it starts their processing. This ensures that a single URL is not crawled multiple times.
 *
 * The crawler finishes when there are no more {@link Request} objects to crawl.
 *
 * By default, `CheerioCrawler` downloads HTML using the
 * <a href="https://www.npmjs.com/package/request" target="_blank">request</a> NPM package.
 * You can use the `requestOptions` parameter to pass additional options to `request`.
 *
 * New requests are only dispatched when there is enough free CPU and memory available,
 * using the functionality provided by the {@link AutoscaledPool} class.
 * All {@link AutoscaledPool} configuration options can be passed to the `autoscaledPoolOptions`
 * parameter of the `CheerioCrawler` constructor. For user convenience, the `minConcurrency` and `maxConcurrency`
 * {@link AutoscaledPool} options are available directly in the `CheerioCrawler` constructor.
 *
 * **Example usage:**
 *
 * ```javascript
 * // Prepare a list of URLs to crawl
 * const requestList = new Apify.RequestList({
 *   sources: [
 *       { url: 'http://www.example.com/page-1' },
 *       { url: 'http://www.example.com/page-2' },
 *   ],
 * });
 * await requestList.initialize();
 *
 * // Crawl the URLs
 * const crawler = new Apify.CheerioCrawler({
 *     requestList,
 *     handlePageFunction: async ({ request, response, body, contentType, $ }) => {
 *         const data = [];
 *
 *         // Do some data extraction from the page with Cheerio.
 *         $('.some-collection').each((index, el) => {
 *             data.push({ title: $(el).find('.some-title').text() });
 *         });
 *
 *         // Save the data to dataset.
 *         await Apify.pushData({
 *             url: request.url,
 *             html: body,
 *             data,
 *         })
 *     },
 * });
 *
 * await crawler.run();
 * ```
 * @template RequestUserData
 * @template SessionUserData
 */
declare class CheerioCrawler<RequestUserData, SessionUserData> {
    /**
     * @param {CheerioCrawlerOptions<RequestUserData, SessionUserData>} options
     */
    constructor(options?: CheerioCrawlerOptions<RequestUserData, SessionUserData>);
    supportedMimeTypes: Set<string>;
    requestOptions: any;
    handlePageFunction: any;
    handlePageTimeoutMillis: number;
    requestTimeoutMillis: number;
    ignoreSslErrors: any;
    useApifyProxy: any;
    apifyProxyGroups: any;
    apifyProxySession: any;
    proxyUrls: any[];
    lastUsedProxyUrlIndex: number;
    prepareRequestFunction: any;
    persistCookiesPerSession: any;
    useSessionPool: any;
    /** @type {BasicCrawler<RequestUserData, SessionUserData>} */
    basicCrawler: BasicCrawler<RequestUserData, SessionUserData>;
    isRunningPromise: Promise<void> | null;
    /**
     * Runs the crawler. Returns promise that gets resolved once all the requests got processed.
     *
     * @return {Promise<void>}
     */
    run(): Promise<void>;
    /**
     * Wrapper around handlePageFunction that opens and closes pages etc.
     *
     * @param {Object} options
     * @param {Request<*>} options.request
     * @param {AutoscaledPool} options.autoscaledPool
     * @param {Session<*>} options.session
     * @ignore
     */
    _handleRequestFunction({ request, autoscaledPool, session }: {
        request: Request<any>;
        autoscaledPool: AutoscaledPool;
        session: Session<any>;
    }): Promise<any>;
    /**
     * Function to make the HTTP request. It performs optimizations
     * on the request such as only downloading the request body if the
     * received content type matches text/html, application/xml, application/xhtml+xml.
     *
     * @param {Object} options
     * @param {Request<*>} options.request
     * @param {Session<*>} options.session
     * @ignore
     */
    _requestFunction({ request, session }: {
        request: Request<any>;
        session: Session<any>;
    }): Promise<{
        dom: any;
        isXml: boolean;
        response: any;
        contentType: {
            type: string;
            encoding: any;
        };
        body?: undefined;
    } | {
        body: any;
        response: any;
        contentType: {
            type: string;
            encoding: any;
        };
        dom?: undefined;
        isXml?: undefined;
    }>;
    /**
     * Combines the provided `requestOptions` with mandatory (non-overridable) values.
     * @param {Request<*>} request
     * @param {Session<*>} [session]
     * @ignore
     */
    _getRequestOptions(request: Request<any>, session?: Session<any> | undefined): any;
    /**
     * Enables the use of a proxy by returning a proxy URL
     * based on configured options or null if no proxy is used.
     * @param {Session<*>} [session]
     * @returns {string|null}
     * @ignore
     */
    _getProxyUrl(session?: Session<any> | undefined): string | null;
    _encodeResponse(request: any, response: any, encoding: any): {
        response: any;
        encoding: any;
    };
    _parseHtmlToDom(response: any): Promise<any>;
    /**
     * Checks and extends supported mime types
     * @param {Array<string|Object>} additionalMimeTypes
     * @ignore
     */
    _extendSupportedMimeTypes(additionalMimeTypes: (string | Object)[]): void;
    /**
     * Handles blocked request
     * @param {Session<*>} session
     * @param {number} statusCode
     * @private
     */
    _throwOnBlockedRequest(session: Session<any>, statusCode: number): void;
    /**
     * Handles timeout request
     * @param {Session<*>} session
     * @private
     */
    _handleRequestTimeout(session: Session<any>): void;
}
import { RequestList } from "../request_list";
import { RequestQueue } from "../request_queue";
import * as utilsRequest from "../utils_request";
import { HandleFailedRequest } from "./basic_crawler";
import { AutoscaledPoolOptions } from "../autoscaling/autoscaled_pool";
import { SessionPoolOptions } from "../session_pool/session_pool";
import Request from "../request";
import { IncomingMessage } from "http";
import AutoscaledPool from "../autoscaling/autoscaled_pool";
import { Session } from "../session_pool/session";
import BasicCrawler from "./basic_crawler";
