/**
 * This example shows shows act that has short runtime - just few seconds. It opens webpage
 * http://goldengatebridge75.org/news/webcam.html that contains webcam stream from Golden Gate
 * bridge, takes a screenshot and saves it as output.
 *
 * This way act can be executed synchronously and return that image in single call.
 *
 * This example is shared in library under: https://www.apify.com/apify/example-golden-gate-webcam
 *
 * So you can easily run it with request to:
 *
 * https://api.apify.com/v2/acts/apify~example-golden-gate-webcam/run-sync?token=[YOUR_API_TOKEN]
 */

const Apify = require('apify');

Apify.main(async () => {
    const browser = await Apify.launchPuppeteer();

    // Load http://goldengatebridge75.org/news/webcam.html and get an iframe
    // containing webcam stream.
    const page = await browser.newPage();
    await page.goto('http://goldengatebridge75.org/news/webcam.html');
    const iframe = (await page.frames()).pop();

    // Get webcam image element handle.
    const imageElementHandle = await iframe.$('.VideoColm img');

    // Get a screenshot of that image.
    const imageBuffer = await imageElementHandle.screenshot();

    // Save it as an output.
    await Apify.setValue('OUTPUT', imageBuffer, { contentType: 'image/jpeg' });
});
