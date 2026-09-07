import { existsSync } from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { Browser } from "puppeteer-core";

const LOCAL_CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((p): p is string => Boolean(p));

function localChromePath(): string | null {
  return LOCAL_CHROME_CANDIDATES.find((p) => existsSync(p)) ?? null;
}

async function launchBrowser(): Promise<Browser> {
  const serverless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  );

  if (!serverless) {
    const executablePath = localChromePath();
    if (!executablePath) {
      throw new Error(
        "Chrome is not installed locally. Set CHROME_PATH or install Google Chrome."
      );
    }
    return puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--hide-scrollbars", "--disable-gpu"],
    });
  }

  chromium.setGraphicsMode = false;
  return puppeteer.launch({
    args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });
}

async function waitForDocument(page: Awaited<ReturnType<Browser["newPage"]>>) {
  await page.waitForSelector('[data-pdf-ready="true"]', { timeout: 25000 });
  await page.evaluate(async () => {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
    const images = Array.from(document.images);
    await Promise.all(
      images.map((img) =>
        img.complete
          ? null
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
      )
    );
  });
  await new Promise((r) => setTimeout(r, 400));
}

export async function renderPrintUrlToPdf(
  printUrl: string,
  opts: { landscape?: boolean } = {}
): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: opts.landscape ? 1400 : 1200,
      height: opts.landscape ? 900 : 1600,
      deviceScaleFactor: 2,
    });
    await page.emulateMediaType("print");
    await page.goto(printUrl, {
      waitUntil: "networkidle2",
      timeout: 45000,
    });
    await waitForDocument(page);
    const pdf = await page.pdf({
      format: "A4",
      landscape: Boolean(opts.landscape),
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });
    await page.close();
    return pdf;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
