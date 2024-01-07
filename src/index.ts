import puppeteer, { Browser, Page } from "puppeteer";
import { inspect } from "util";
import { writeFileSync, readFileSync } from "fs";
import { COOKIES } from "./config";

const USAGE = `node dist [OPTIONS]
Options:
  -p,   --page                          Set start page
  -h,   --help                          Show this message and exit
  --head                                Show chromium browser
  --get-details </path/to/data.json>    Get more details for this data.json (!TODO)
`;

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.0 Safari/537.36";
const PAGE_URL =
  "https://finder.startupnationcentral.org/startups/search?&primarysectorclassification=agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4IfeyLoKDA";

const companyList: IEntryResult[] = [];

let pageNumber = 1;
const opt = {
  headless: true,
};

for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  const argVal = process.argv[i + 1];
  switch (arg) {
    case "-p":
    case "--page": {
      // set pageNumber
      try {
        pageNumber = parseInt(argVal);
      } catch (e) {
        console.error(e);
        console.error("Can't parse argument:", arg);
        console.error("with value:", argVal);
        process.exit(1);
      }
      break;
    }
    case "--head": {
      opt.headless = false;
      break;
    }
    case "-h":
    case "--help": {
      console.log(USAGE);

      process.exit();
    }
  }
}

console.error(
  "Please quitting by typing 'q' then press ENTER into your terminal to avoid corrupt data",
);

const bot = puppeteer.launch(opt);

let browser: Browser;

bot.then((b) => {
  browser = b;
  onReady();
});

process.stdin.on("data", (buf) => {
  handleCommand(buf);
});

function quit() {
  console.error("Saving data to json...");
  console.error(inspect(companyList));

  writeDataToJson();
  process.exit();
}

function loadSavedData() {
  try {
    console.error("Loading saved data");

    const data = readFileSync("data.json");
    const dataStr = data.toString();
    const list = JSON.parse(dataStr);

    if (!Array.isArray(list)) {
      console.error(new Error("Invalid saved data"));
      process.exit(1);
    }

    companyList.push(...list);

    console.error(inspect(list));
  } catch (e) {
    console.error(e);
    console.error(
      "You may ignore the above error if it's the first time you run this program and you don't have saved data.json in current working directory",
    );
  }
}

function writeDataToJson() {
  console.error("Writing to data.json");
  writeFileSync("data.json", JSON.stringify(companyList, null, 2));
}

async function onReady() {
  loadSavedData();

  const pages = await browser.pages();
  run(pages[0]);
}

async function handleCommand(cmdBuf: Buffer) {
  const cmd = cmdBuf.toString().slice(0, -1);

  switch (cmd) {
    case "q":
      return quit();
  }
}

function pageParam(n?: number) {
  if (typeof n !== "number") return "";
  return `&page=${n}`;
}

async function sleep(n: number) {
  return new Promise((r, rj) => setTimeout(r, n));
}

async function run(page: Page) {
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1920, height: 1080 });

  let cpyPageNumber = pageNumber;

  const pUrl = PAGE_URL + pageParam(cpyPageNumber);
  await page.goto(pUrl);

  await page.setCookie(...COOKIES);
  await page.goto(pUrl);
  await sleep(2000);

  while (true) {
    await scrp(page);

    const newPg = ++cpyPageNumber;
    const newUrl = PAGE_URL + pageParam(newPg);
    console.error("Navigating to page:", newPg, "URL:", newUrl);

    await page.goto(newUrl);
    await sleep(5000);
  }
}

////////////////////////////////////////////////////////////////////////////////

interface IEntryResult {
  href?: string;
  logo?: {
    alt: string;
    src: string;
    srcSet: string;
  };
  name?: string;
  description?: string;
  claimed?: boolean;
  status?: string;
  founded?: string;
  businessModel?: string;
  employees?: string;
  fundingStage?: string;
  totalRaised?: string;
  tags?: string[];
}

async function scrp(page: Page) {
  const evaluateRes = await page.evaluate(() => {
    const mtc = document.getElementById("main-table-content");
    if (!mtc) {
      console.error("mtc null");
      return [];
    }

    const cmps = mtc.getElementsByClassName(
      "company",
    ) as HTMLCollectionOf<HTMLDivElement>;

    ////////////////////////////////////////////////////////////////////////////////

    function getImageColumnData(el: HTMLImageElement) {
      if (!el) return undefined;

      return {
        alt: el.alt,
        src: el.currentSrc,
        srcSet: el.srcset,
      };
    }

    function getTags(tableRows: HTMLCollectionOf<Element>) {
      const tagList = tableRows[6]?.getElementsByClassName("classification");

      const tags = [];
      for (const entry of tagList) {
        if (entry.textContent?.length) tags.push(entry.textContent);
      }

      return tags;
    }

    ////////////////////////////////////////////////////////////////////////////////

    const allEntries: IEntryResult[] = [];

    for (const entry of cmps) {
      const result: IEntryResult = {} as IEntryResult;

      result.href = (entry.parentElement as HTMLAnchorElement)?.href;
      result.logo = getImageColumnData(
        entry.getElementsByClassName("image-column")[0]
          ?.children[0] as HTMLImageElement,
      );

      const cNameEl = entry.getElementsByClassName("company-name")[0];
      const tableRows = entry.getElementsByClassName("table-row-item");

      result.name = cNameEl?.childNodes[0]?.textContent ?? undefined;
      result.description = tableRows[0]?.children[2]?.textContent ?? undefined;
      result.claimed = !!cNameEl?.getElementsByClassName(
        "claim-badge-tooltip",
      )[0];
      result.status =
        entry.getElementsByClassName("comapny-status-text")[0]?.textContent ??
        undefined;
      result.founded = tableRows[1]?.textContent ?? undefined;
      result.businessModel = tableRows[2]?.textContent ?? undefined;
      result.employees = tableRows[3]?.textContent ?? undefined;
      result.fundingStage = tableRows[4]?.textContent ?? undefined;
      result.totalRaised = tableRows[5]?.textContent ?? undefined;
      result.tags = getTags(tableRows);

      allEntries.push(result);
    }

    return allEntries;
  });

  // console.error(inspect(evaluateRes));

  companyList.push(...evaluateRes);

  writeDataToJson();
}
