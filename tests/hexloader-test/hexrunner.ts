import "mocha";
import { expect } from "chai";

describe("HEX loading", () => {
    const hex = ":020000040000FA\n:1000000000000000000000000000000000000000F0\n:00000001FF";
    const html = "<!DOCTYPE html>\n<html>MakeCode</html>";
    const httpRequestCoreAsync = pxt.Util.httpRequestCoreAsync;
    const webConfig = pxt.webConfig;
    const apiRoot = pxt.Cloud.apiRoot;
    let requests: pxt.Util.HttpRequestOptions[];
    let cache: pxt.Map<string>;
    let bundledHex: string;
    let cdnMiss: boolean;
    let sequence = 0;
    let extInfo: pxtc.ExtensionInfo;

    const host: pxt.Host = {
        readFile: () => null,
        writeFile: () => {},
        downloadPackageAsync: async () => {},
        getHexInfoAsync: info => pxt.hexloader.getHexInfoAsync(host, info),
        cacheGetAsync: async id => cache[id],
        cacheStoreAsync: async (id, value) => { cache[id] = value; }
    };

    beforeEach(() => {
        requests = [];
        cache = {};
        bundledHex = hex;
        cdnMiss = false;
        extInfo = { sha: `hexloader-${sequence++}`, compileData: "extension-source" } as pxtc.ExtensionInfo;
        pxt.webConfig = { isStatic: true, cdnUrl: "/bundled/", commitCdnUrl: "" } as pxt.WebConfig;
        pxt.Cloud.apiRoot = "https://class.codle.io/api/";
        pxt.Util.httpRequestCoreAsync = async options => {
            requests.push(options);
            if (options.url.startsWith("/bundled/hexcache/")) {
                if (bundledHex === undefined) throw new Error("404");
                return { statusCode: 200, headers: {}, text: bundledHex };
            }
            if (options.url === "https://www.makecode.com/api/clientconfig") {
                return { statusCode: 200, headers: {}, json: { primaryCdnUrl: "https://cdn.makecode.com" } };
            }
            if (options.url === "https://www.makecode.com/api/compile/extension") {
                cdnMiss = false;
                return { statusCode: 200, headers: {}, json: { hex: `https://cdn.makecode.com/compile/${extInfo.sha}.hex` } };
            }
            if (options.url === `https://cdn.makecode.com/compile/${extInfo.sha}.json`) {
                return { statusCode: 200, headers: {}, json: { success: true } };
            }
            expect(options.url).to.equal(`https://cdn.makecode.com/compile/${extInfo.sha}.hex`);
            if (cdnMiss) throw new Error("404");
            return { statusCode: 200, headers: {}, text: hex };
        };
    });

    afterEach(() => {
        pxt.Util.httpRequestCoreAsync = httpRequestCoreAsync;
        pxt.webConfig = webConfig;
        pxt.Cloud.apiRoot = apiRoot;
    });

    it("uses a bundled HEX without contacting the compiler", async () => {
        expect((await host.getHexInfoAsync(extInfo)).hex).to.deep.equal(hex.split("\n"));
        expect(requests.map(request => request.url)).to.deep.equal([`/bundled/hexcache/${extInfo.sha}.hex`]);
    });

    for (const response of [html, undefined]) {
        it(`falls back to the MakeCode CDN after ${response === undefined ? "404" : "HTML with status 200"}`, async () => {
            bundledHex = response;
            expect((await host.getHexInfoAsync(extInfo)).hex).to.deep.equal(hex.split("\n"));
            expect(requests.some(request => request.url === `https://cdn.makecode.com/compile/${extInfo.sha}.hex`)).to.equal(true);
            expect(requests.some(request => request.url.startsWith(pxt.Cloud.apiRoot))).to.equal(false);
        });
    }

    it("replaces an HTML response persisted in the HEX cache", async () => {
        cache[`hex-${extInfo.sha}`] = JSON.stringify({ hex: html.split("\n") });
        bundledHex = html;
        expect((await host.getHexInfoAsync(extInfo)).hex).to.deep.equal(hex.split("\n"));
        expect(JSON.parse(cache[`hex-${extInfo.sha}`]).hex[0]).to.equal(":020000040000FA");
    });

    it("keeps valid compressed HEX cache entries", async () => {
        cache[`hex-${extInfo.sha}`] = JSON.stringify({ hex: ["@0000", "1", ":00000001FF"] });
        expect((await host.getHexInfoAsync(extInfo)).hex).to.deep.equal(hex.split("\n").slice(1));
        expect(requests).to.deep.equal([]);
    });

    it("submits uncached extensions to the MakeCode compiler", async () => {
        bundledHex = html;
        cdnMiss = true;
        expect((await host.getHexInfoAsync(extInfo)).hex).to.deep.equal(hex.split("\n"));
        expect(requests.find(request => request.method === "POST")).to.deep.equal({
            url: "https://www.makecode.com/api/compile/extension",
            method: "POST",
            data: { data: extInfo.compileData },
            allowGzipPost: true
        });
    });
});
